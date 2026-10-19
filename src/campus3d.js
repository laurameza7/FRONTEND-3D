import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

/*
 * Modelo 3D del campus Pasto (Calle 18 N.º 45-150, Torobajo).
 * Coordenadas en metros: x hacia la Carrera 45 (oriente), z hacia la Calle 18 (frente).
 * Los edificios llegan del backend; calles, barrio y vegetación son decorado.
 */
const ALTURA_PISO = 3.6;
const ALTURA_SOTANO = 3.2;
const SEPARACION_SOTANOS = 9;  // en la vista de sótanos los niveles se separan para leerlos
const CALLE_18_Z = 40;     // eje de la Calle 18
const CARRERA_45_X = 54;   // eje de la Carrera 45
const VISTA_GENERAL = { camara: new THREE.Vector3(-58, 52, 88), objetivo: new THREE.Vector3(10, 6, -10) };
const VISTA_SOTANOS = { camara: new THREE.Vector3(-30, 14, 70), objetivo: new THREE.Vector3(12, -10, -12) };

export class Campus3D {
  constructor(contenedor, { alSeleccionar } = {}) {
    this.contenedor = contenedor;
    this.alSeleccionar = alSeleccionar;
    this.bloques = new Map();       // id -> { grupo, etiqueta, datos, materiales }
    this.seleccionado = null;
    this.animacion = null;
    this.sotanosVisibles = false;

    this.#crearEscena();
    this.#crearEntorno();
    this.#eventos();
    this.renderer.setAnimationLoop(() => this.#cuadro());
  }

  /* ================================================================ Escena base */
  #crearEscena() {
    const { clientWidth: w, clientHeight: h } = this.contenedor;

    this.escena = new THREE.Scene();
    this.escena.background = new THREE.Color('#dce8f2');
    this.escena.fog = new THREE.Fog('#dce8f2', 220, 420);

    this.camara = new THREE.PerspectiveCamera(42, w / h, 0.5, 900);
    this.camara.position.copy(VISTA_GENERAL.camara);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.contenedor.appendChild(this.renderer.domElement);

    this.etiquetas = new CSS2DRenderer();
    this.etiquetas.setSize(w, h);
    Object.assign(this.etiquetas.domElement.style, { position: 'absolute', top: '0', pointerEvents: 'none' });
    this.contenedor.appendChild(this.etiquetas.domElement);

    this.controles = new OrbitControls(this.camara, this.renderer.domElement);
    this.controles.enableDamping = true;
    this.controles.maxPolarAngle = Math.PI * 0.47;
    this.controles.minDistance = 20;
    this.controles.maxDistance = 260;
    this.controles.target.copy(VISTA_GENERAL.objetivo);

    this.escena.add(new THREE.HemisphereLight('#ffffff', '#8fa08a', 1.25));
    const sol = new THREE.DirectionalLight('#fff6e8', 1.9);
    sol.position.set(70, 120, 50);
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    sol.shadow.bias = -0.0004;
    Object.assign(sol.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, far: 320 });
    this.escena.add(sol);
  }

  /* ================================================================ Calles, barrio y montañas */
  #crearEntorno() {
    // Suelo (se vuelve translúcido al ver los sótanos)
    this.materialSuelo = new THREE.MeshStandardMaterial({ color: '#c9cdc6', roughness: 1 });
    const suelo = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), this.materialSuelo);
    suelo.rotation.x = -Math.PI / 2;
    suelo.receiveShadow = true;
    this.escena.add(suelo);

    // Lote del campus
    this.materialLote = new THREE.MeshStandardMaterial({ color: '#d9d4c8', roughness: 1 });
    const lote = new THREE.Mesh(new THREE.PlaneGeometry(76, 82), this.materialLote);
    lote.rotation.x = -Math.PI / 2;
    lote.position.set(8, 0.02, -7);
    lote.receiveShadow = true;
    this.escena.add(lote);
    this.suelos = [this.materialSuelo, this.materialLote];

    // Calle 18 y Carrera 45
    const asfalto = new THREE.MeshStandardMaterial({ color: '#4a4f55', roughness: 0.95 });
    const anden = new THREE.MeshStandardMaterial({ color: '#b9b5ad', roughness: 1 });
    this.#plano(320, 12, 0, CALLE_18_Z, asfalto, 0.04);
    this.#plano(320, 3, 0, CALLE_18_Z - 7.5, anden, 0.06);
    this.#plano(320, 3, 0, CALLE_18_Z + 7.5, anden, 0.06);
    this.#plano(10, 320, CARRERA_45_X, -100, asfalto, 0.05);
    this.#plano(2.5, 280, CARRERA_45_X - 6.2, -110, anden, 0.06);
    this.#plano(2.5, 280, CARRERA_45_X + 6.2, -110, anden, 0.06);
    const linea = new THREE.MeshBasicMaterial({ color: '#f2d36b' });
    for (let x = -150; x < 160; x += 9) this.#plano(4, 0.25, x, CALLE_18_Z, linea, 0.07);
    for (let z = -250; z < 30; z += 9) this.#plano(0.25, 4, CARRERA_45_X, z, linea, 0.07);
    this.#etiqueta('Calle 18', new THREE.Vector3(-40, 0.5, CALLE_18_Z), 'etiqueta-calle');
    this.#etiqueta('Carrera 45', new THREE.Vector3(CARRERA_45_X, 0.5, -70), 'etiqueta-calle');

    // Barrio alrededor (bloques bajos, posiciones fijas)
    this.barrio = new THREE.Group();
    this.escena.add(this.barrio);
    const colores = ['#d8d2c4', '#c9c3b8', '#e2dcd0', '#bfb9ad', '#d3c6b4', '#cfd4d8'];
    let semilla = 11;
    const azar = () => ((semilla = (semilla * 9301 + 49297) % 233280) / 233280);
    const casa = (x, z) => {
      const w = 7 + azar() * 9, d = 7 + azar() * 9, h = 3 + Math.floor(azar() * 4) * 3;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: colores[Math.floor(azar() * colores.length)], roughness: 0.95 }));
      m.position.set(x, h / 2, z);
      m.castShadow = m.receiveShadow = true;
      this.barrio.add(m);
    };
    for (let x = -110; x <= 120; x += 15) for (let z = CALLE_18_Z + 16; z <= 120; z += 15) casa(x + azar() * 3, z + azar() * 3);
    for (let x = CARRERA_45_X + 15; x <= 130; x += 15) for (let z = -120; z < CALLE_18_Z - 10; z += 15) casa(x + azar() * 3, z + azar() * 3);
    for (let x = -110; x < -36; x += 15) for (let z = -120; z < CALLE_18_Z - 10; z += 15) casa(x + azar() * 3, z + azar() * 3);
    for (let x = -30; x < CARRERA_45_X - 12; x += 15) for (let z = -130; z < -56; z += 15) casa(x + azar() * 3, z + azar() * 3);

    // Montañas verdes de fondo (como en las fotos del campus)
    const verde = new THREE.MeshStandardMaterial({ color: '#7f9f6a', roughness: 1, flatShading: true });
    [[-200, -380, 150, 55], [-20, -400, 170, 70], [170, -380, 150, 50]].forEach(([x, z, r, h]) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), verde);
      m.scale.set(r, h, r * 0.7);
      m.position.set(x, 0, z);
      this.escena.add(m);
    });

    // Sótanos (se muestran con el botón "Ver sótanos")
    this.grupoSotanos = new THREE.Group();
    this.grupoSotanos.visible = false;
    this.escena.add(this.grupoSotanos);
  }

  #plano(w, d, x, z, material, y = 0.03) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    this.escena.add(m);
    return m;
  }

  #etiqueta(texto, posicion, clase = 'etiqueta-3d', padre = this.escena) {
    const div = document.createElement('div');
    div.className = clase;
    div.textContent = texto;
    const obj = new CSS2DObject(div);
    obj.position.copy(posicion);
    padre.add(obj);
    return div;
  }

  /* ================================================================ Datos del backend */
  cargar(edificios, lugares = []) {
    for (const e of edificios) {
      const lugaresDe = lugares.filter(l => l.edificioId === e.id);
      let grupo;
      if (e.tipo === 'EDIFICIO') grupo = this.#edificio(e, lugaresDe);
      else if (e.tipo === 'ACCESO') grupo = this.#acceso(e);
      else if (e.tipo === 'ZONA_VERDE') grupo = this.#sendero(e);
      else if (e.tipo === 'BICICLETAS') grupo = this.#estacionBici(e);
      else if (e.tipo === 'PLAZOLETA') grupo = this.#plazoletaMesas(e);
      else grupo = this.#piso(e);

      grupo.position.set(e.x, 0, e.z);
      grupo.traverse(o => { o.userData.id = e.id; });
      this.escena.add(grupo);

      const altura = { EDIFICIO: e.pisos * ALTURA_PISO + 8, ACCESO: 12, BICICLETAS: 5, PLAZOLETA: 5 }[e.tipo] ?? 2;
      const etiqueta = this.#etiqueta(e.nombre, new THREE.Vector3(0, altura, 0), 'etiqueta-3d', grupo);

      const materiales = [];
      grupo.traverse(o => {
        const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        ms.forEach(m => { if (m.emissive && !materiales.includes(m)) materiales.push(m); });
      });
      this.bloques.set(e.id, { grupo, etiqueta, datos: e, materiales });
    }
    this.#sotanos(edificios.filter(e => e.tipo === 'EDIFICIO' && e.sotanos > 0), lugares);
  }

  /* ---------------------------------------------------------------- Bloques de ladrillo */
  #edificio(e, lugares) {
    const grupo = new THREE.Group();
    const alto = e.pisos * ALTURA_PISO;
    const conBahias = e.codigo === 'B';   // el Bloque B tiene bahías verticales de vidrio
    const conCanchas = lugares.some(l => l.tipo === 'DEPORTIVO' && l.piso >= e.pisos);

    const fachadaLarga = texturaFachada(e.ancho, e.pisos, e.color, conBahias);
    const fachadaCorta = texturaFachada(e.profundidad, e.pisos, e.color, conBahias);
    const lado = (tex) => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
    const techo = new THREE.MeshStandardMaterial({ color: conCanchas ? '#5d6166' : '#c8643a', roughness: 0.9 });
    const base = new THREE.MeshStandardMaterial({ color: '#6b6f73' });
    // orden de caras en BoxGeometry: +x, -x, +y, -y, +z, -z
    const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(e.ancho, alto, e.profundidad),
      [lado(fachadaCorta), lado(fachadaCorta), techo, base, lado(fachadaLarga), lado(fachadaLarga)]);
    cuerpo.position.y = alto / 2;
    cuerpo.castShadow = cuerpo.receiveShadow = true;
    grupo.add(cuerpo);

    // Pretil del techo
    const pretil = new THREE.Mesh(
      new THREE.BoxGeometry(e.ancho + 0.4, 1.1, e.profundidad + 0.4),
      new THREE.MeshStandardMaterial({ color: e.color, roughness: 0.9 }));
    pretil.position.y = alto + 0.55;
    const hueco = new THREE.Mesh(new THREE.BoxGeometry(e.ancho - 0.6, 0.9, e.profundidad - 0.6), techo);
    hueco.position.y = alto + 0.45;
    grupo.add(pretil, hueco);

    if (conCanchas) this.#canchas(grupo, e, alto + 1.2);
    else this.#equiposTechos(grupo, e, alto + 0.95);
    if (e.codigo === 'B') this.#entradaBloqueB(grupo, e);
    if (e.codigo === 'A') this.#logoBloqueA(grupo, e, alto);
    return grupo;
  }

  /** Entrada del Bloque B sobre el sendero: puertas de vidrio, aviso y rampas con baranda. */
  #entradaBloqueB(grupo, e) {
    const x = -e.ancho / 2;
    const marco = new THREE.MeshStandardMaterial({ color: '#2b2f33', metalness: 0.4 });
    const vidrio = new THREE.MeshStandardMaterial({ color: '#7fb4c9', transparent: true, opacity: 0.55, metalness: 0.3 });
    const puerta = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.8, 5), vidrio);
    puerta.position.set(x - 0.05, 1.4, 0);
    const voladizo = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 7), new THREE.MeshStandardMaterial({ color: '#e9e6df' }));
    voladizo.position.set(x - 0.8, 3.2, 0);
    const aviso = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 2.4), [
      new THREE.MeshStandardMaterial({ map: texturaTexto('BLOQUE B', '#1f9bb0', '#ffffff', 256, 80) }), marco, marco, marco, marco, marco]);
    aviso.rotation.y = Math.PI;
    aviso.position.set(x - 0.12, 3.8, 0);
    grupo.add(puerta, voladizo, aviso);
    // Rampas a ambos lados de la puerta y muros bajos
    const rampaMat = new THREE.MeshStandardMaterial({ color: '#cfcac1', roughness: 1 });
    const muro = new THREE.MeshStandardMaterial({ color: '#7c7d6b' });
    for (const lado of [-1, 1]) {
      const rampa = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 7), rampaMat);
      rampa.position.set(x - 3, 0.35, lado * 6.2);
      rampa.rotation.x = lado * 0.07;
      const pretil = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1, 7.5), muro);
      pretil.position.set(x - 4.3, 0.5, lado * 6.2);
      const baranda = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 7.5), marco);
      baranda.position.set(x - 4.3, 1.2, lado * 6.2);
      grupo.add(rampa, pretil, baranda);
    }
    const plaza = new THREE.Mesh(new THREE.BoxGeometry(4, 0.12, 5), rampaMat);
    plaza.position.set(x - 2, 0.06, 0);
    grupo.add(plaza);
  }

  /** Logo de la universidad en lo alto de la fachada del Bloque A que mira al sendero. */
  #logoBloqueA(grupo, e, alto) {
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.2),
      new THREE.MeshStandardMaterial({ map: texturaLogoLinea(), transparent: true }));
    logo.position.set(-e.ancho / 2 + 7, alto - 1.6, e.profundidad / 2 + 0.06);
    grupo.add(logo);
  }

  #canchas(grupo, e, y) {
    const lineas = new THREE.LineBasicMaterial({ color: '#ffffff' });
    const cancha = (w, d, x, color, nombre) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
      m.position.set(x, y, 0);
      m.receiveShadow = true;
      grupo.add(m);
      const borde = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w - 1.2, 0.01, d - 1.2)), lineas);
      borde.position.set(x, y + 0.08, 0);
      const mitad = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, d - 1.2), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      mitad.position.set(x, y + 0.08, 0);
      grupo.add(borde, mitad);
      this.#etiqueta(nombre, new THREE.Vector3(x, y + 1.5, 0), 'etiqueta-mini', grupo);
      return m;
    };
    const sep = e.ancho * 0.24;
    cancha(Math.min(22, e.ancho * 0.5), Math.min(14, e.profundidad - 4), -sep, '#3f9a52', 'Cancha sintética');
    cancha(Math.min(16, e.ancho * 0.36), Math.min(9, e.profundidad - 6), sep + 2, '#d7b98a', 'Voleibol');
    // Malla perimetral y red de voleibol
    const malla = new THREE.Mesh(new THREE.BoxGeometry(e.ancho - 0.8, 4, e.profundidad - 0.8),
      new THREE.MeshBasicMaterial({ color: '#2c3e50', wireframe: true, transparent: true, opacity: 0.18 }));
    malla.position.y = y + 2;
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, Math.min(9, e.profundidad - 6)),
      new THREE.MeshStandardMaterial({ color: '#f5f5f5', transparent: true, opacity: 0.8 }));
    red.position.set(sep + 2, y + 2.4, 0);
    grupo.add(malla, red);
  }

  #equiposTechos(grupo, e, y) {
    // Paneles solares y equipos como se ven en la vista satélite
    const panel = new THREE.MeshStandardMaterial({ color: '#273445', metalness: 0.4, roughness: 0.35 });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.15, 1.8), panel);
      p.position.set(-e.ancho / 2 + 3 + j * 3.6, y + 0.3, -e.profundidad / 2 + 3 + i * 2.2);
      p.rotation.z = 0.15;
      grupo.add(p);
    }
    const tanque = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.8, 16), new THREE.MeshStandardMaterial({ color: '#3b6fb6' }));
    tanque.position.set(e.ancho / 2 - 3, y + 0.9, e.profundidad / 2 - 4);
    grupo.add(tanque);
  }

  /* ---------------------------------------------------------------- Pabellón de acceso */
  /*
   * Como en las fotos: una cubierta inclinada de policarbonato sobre cerchas de acero, que sube
   * hacia la esquina del aviso de la UCC; debajo, fachadas de vidrio con afiches, un muro de
   * madera, los locales de Comuna y Bonne Vie, la portería con torniquetes y la terraza.
   */
  #acceso(e) {
    const g = new THREE.Group();
    const W = e.ancho, D = e.profundidad;
    const acero = new THREE.MeshStandardMaterial({ color: '#9aa3aa', metalness: 0.6, roughness: 0.35 });
    const vidrio = new THREE.MeshStandardMaterial({ color: '#a9c7d8', transparent: true, opacity: 0.4, roughness: 0.1, metalness: 0.3 });
    const policarbonato = new THREE.MeshStandardMaterial({ color: '#eef2f4', transparent: true, opacity: 0.55, side: THREE.DoubleSide, roughness: 0.3 });
    const madera = new THREE.MeshStandardMaterial({ color: '#7a3f26', roughness: 0.7 });
    const piso = new THREE.MeshStandardMaterial({ color: '#b9b5ae', roughness: 0.9 });

    // Piso interior y plaza de ladrillo en espina de pescado al frente
    const base = new THREE.Mesh(new THREE.BoxGeometry(W, 0.15, D), piso);
    base.position.y = 0.075; base.receiveShadow = true;
    const plaza = new THREE.Mesh(new THREE.BoxGeometry(W + 10, 0.1, 6),
      new THREE.MeshStandardMaterial({ map: texturaEspina(), roughness: 1 }));
    plaza.position.set(-2, 0.05, D / 2 + 3); plaza.receiveShadow = true;
    g.add(base, plaza);

    // Cubierta inclinada: baja en el extremo occidental (5 m), alta en el aviso (10 m)
    const altura = (x) => 5 + (x + W / 2) / W * 5;
    const forma = new THREE.Shape();
    forma.moveTo(-W / 2 - 1.5, altura(-W / 2 - 1.5));
    forma.lineTo(W / 2 + 0.5, altura(W / 2 + 0.5));
    forma.lineTo(W / 2 + 0.5, altura(W / 2 + 0.5) - 0.25);
    forma.lineTo(-W / 2 - 1.5, altura(-W / 2 - 1.5) - 0.25);
    forma.closePath();
    const cubierta = new THREE.Mesh(new THREE.ExtrudeGeometry(forma, { depth: D + 3, bevelEnabled: false }), policarbonato);
    cubierta.position.z = -D / 2 - 1;
    cubierta.castShadow = true;
    g.add(cubierta);
    // Cerchas (vigas y diagonales) bajo la cubierta
    for (let x = -W / 2; x <= W / 2 + 0.01; x += W / 6) {
      const h = altura(x);
      const viga = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, D + 3), acero);
      viga.position.set(x, h - 0.35, 0.5);
      const columna = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, h, 8), acero);
      columna.position.set(x, h / 2, D / 2 + 1);
      g.add(viga, columna);
      for (let z = -D / 2; z < D / 2 + 1; z += 2.4) {
        const diag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 2.8), acero);
        diag.position.set(x, h - 0.9, z + 1.2);
        diag.rotation.x = 0.4;
        g.add(diag);
      }
    }
    for (let z = -D / 2; z <= D / 2 + 2; z += 2.4) {
      const correa = new THREE.Mesh(new THREE.BoxGeometry(W + 2, 0.1, 0.1), acero);
      correa.position.set(-0.5, (altura(-W / 2) + altura(W / 2)) / 2 - 0.3, z);
      correa.rotation.z = Math.atan2(altura(W / 2) - altura(-W / 2), W);
      g.add(correa);
    }

    // Fachada frontal: vidrio con afiches (izquierda), muro de madera inclinado, locales (derecha)
    const afiches = new THREE.Mesh(new THREE.BoxGeometry(W * 0.42, 3.6, 0.15), [
      vidrio, vidrio, vidrio, vidrio, new THREE.MeshStandardMaterial({ map: texturaAfiches() }), vidrio]);
    afiches.position.set(-W / 2 + W * 0.21, 1.8, D / 2);
    const muroMadera = new THREE.Mesh(new THREE.BoxGeometry(W * 0.16, 4.2, 0.3), madera);
    muroMadera.position.set(-W / 2 + W * 0.5, 2.1, D / 2 - 1.5);
    const locales = new THREE.Mesh(new THREE.BoxGeometry(W * 0.4, 3.4, 0.15), [
      vidrio, vidrio, vidrio, vidrio, new THREE.MeshStandardMaterial({ map: texturaLocales() }), vidrio]);
    locales.position.set(W / 2 - W * 0.2, 1.7, D / 2 - 0.5);
    g.add(afiches, muroMadera, locales);

    // Gran aviso blanco de la UCC sobre los locales
    const aviso = new THREE.Mesh(new THREE.BoxGeometry(8, 5.2, 0.4), [
      acero, acero, acero, acero, new THREE.MeshStandardMaterial({ map: texturaAviso() }), acero]);
    aviso.position.set(W / 2 - 5.2, 6.4, D / 2 - 0.2);
    aviso.castShadow = true;
    // Panel de oferta académica junto al aviso
    const cartel = new THREE.Mesh(new THREE.BoxGeometry(3.4, 4.2, 0.15), [
      acero, acero, acero, acero, new THREE.MeshStandardMaterial({ map: texturaCartelProgramas() }), acero]);
    cartel.position.set(W / 2 - 11.2, 5.6, D / 2 - 0.4);
    g.add(aviso, cartel);

    // Portería: mesón de madera clara, torniquetes y sillas azules
    const meson = new THREE.Mesh(new THREE.BoxGeometry(5, 1.1, 1.4), new THREE.MeshStandardMaterial({ color: '#d8c3a0' }));
    meson.position.set(-1, 0.7, -0.5);
    g.add(meson);
    for (let i = 0; i < 3; i++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1, 1.1), acero);
      t.position.set(-3.5 + i * 1.2, 0.65, 1.8);
      g.add(t);
    }
    const sillas = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 3), new THREE.MeshStandardMaterial({ color: '#2f4fa3' }));
    sillas.position.set(-W / 2 + 1.2, 0.5, 0);
    g.add(sillas);

    // Terraza de Bonne Vie con mesas y parasoles
    for (let i = 0; i < 3; i++) g.add(mesa(W / 2 + 2.2, D / 2 - 2 - i * 3, i === 1));
    // Rampa de adoquín ecológico al costado
    const rampa = new THREE.Mesh(new THREE.BoxGeometry(5, 0.12, D + 4),
      new THREE.MeshStandardMaterial({ map: texturaAdoquinGrama(), roughness: 1 }));
    rampa.position.set(W / 2 + 2.5, 0.04, -1);
    rampa.receiveShadow = true;
    g.add(rampa);
    return g;
  }

  /* ---------------------------------------------------------------- Sendero de los cipreses */
  #sendero(e) {
    const g = new THREE.Group();
    const L = e.profundidad;
    const tablero = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.14, L),
      new THREE.MeshStandardMaterial({ map: texturaBaldosaDiagonal(L), roughness: 0.9 }));
    tablero.position.y = 0.07; tablero.receiveShadow = true;
    const grama = new THREE.MeshStandardMaterial({ color: '#6fa25a', roughness: 1 });
    const franjaDer = new THREE.Mesh(new THREE.BoxGeometry(3, 0.25, L - 2), grama);
    franjaDer.position.set(4.1, 0.12, 0);
    const franjaIzq = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.25, L - 6), grama);
    franjaIzq.position.set(-3.7, 0.12, 2);
    const adoquin = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, L),
      new THREE.MeshStandardMaterial({ map: texturaAdoquinGrama(), roughness: 1 }));
    adoquin.position.set(-6.1, 0.05, 0);
    g.add(tablero, franjaDer, franjaIzq, adoquin);
    // Cipreses a ambos lados
    for (let z = -L / 2 + 3; z < L / 2 - 1; z += 4.2) {
      g.add(cipres(3.4, z, 7 + ((z * 7) % 3 + 3) % 3));
      g.add(cipres(-3.3, z + 2, 6.5 + ((z * 5) % 2 + 2) % 2));
    }
    // Muros de piedra de las jardineras (izquierda) y flores
    const piedra = new THREE.MeshStandardMaterial({ color: '#6b5a50', roughness: 1, flatShading: true });
    for (const [z, largo] of [[6, 8], [-4, 6]]) {
      const muro = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, largo), piedra);
      muro.position.set(-7.6, 0.45, z);
      g.add(muro);
    }
    for (let z = -L / 2 + 2; z < L / 2 - 2; z += 2.5) g.add(flores(5.2, z));
    // Palmas y yucas junto al Bloque B
    for (const z of [-10, 2, 12]) g.add(palma(6.4, z));
    // Postes de luz
    for (const z of [-12, 0, 12]) g.add(poste(-2.9, z));
    return g;
  }

  /* ---------------------------------------------------------------- Estación UrkuBici */
  #estacionBici(e) {
    const g = new THREE.Group();
    const piso = new THREE.Mesh(new THREE.BoxGeometry(e.ancho, 0.1, e.profundidad),
      new THREE.MeshStandardMaterial({ map: texturaEspina(), roughness: 1 }));
    piso.position.y = 0.05; piso.receiveShadow = true;
    g.add(piso);
    // Cubierta de paneles solares sobre apoyos en V
    const negro = new THREE.MeshStandardMaterial({ color: '#2c3136', metalness: 0.5 });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(e.ancho - 2, 0.15, 4.2),
      new THREE.MeshStandardMaterial({ color: '#1f2e44', metalness: 0.5, roughness: 0.3 }));
    panel.position.set(0, 3.1, 0); panel.rotation.x = -0.12; panel.castShadow = true;
    g.add(panel);
    for (const x of [-e.ancho / 2 + 2, 0, e.ancho / 2 - 2]) for (const s of [-1, 1]) {
      const pata = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.3, 0.15), negro);
      pata.position.set(x + s * 0.7, 1.6, 0.3); pata.rotation.z = s * 0.25;
      g.add(pata);
    }
    // Bicicletas blancas
    for (let i = 0; i < 10; i++) g.add(bicicleta(-e.ancho / 2 + 1.5 + i * 0.95, 0.4));
    // Caseta de ladrillo vecina
    const caseta = new THREE.Mesh(new THREE.BoxGeometry(4, 2.8, 5), new THREE.MeshStandardMaterial({ color: '#b0583f' }));
    caseta.position.set(-e.ancho / 2 - 3, 1.4, 6); caseta.castShadow = true;
    g.add(caseta);
    return g;
  }

  /* ---------------------------------------------------------------- Plazoleta de mesas */
  #plazoletaMesas(e) {
    const g = new THREE.Group();
    const piso = new THREE.Mesh(new THREE.BoxGeometry(e.ancho, 0.1, e.profundidad),
      new THREE.MeshStandardMaterial({ map: texturaAdoquinGrama(), roughness: 1 }));
    piso.position.y = 0.05; piso.receiveShadow = true;
    g.add(piso);
    for (const [x, z] of [[-3, 1], [1.5, 3.5], [3.5, -0.5]]) g.add(mesa(x, z, false));
    // Sala de juegos: pabellón blanco con cubierta clara y ventanas angostas
    const sala = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 4.5), new THREE.MeshStandardMaterial({ color: '#f3f3f1' }));
    sala.position.set(-1, 1.5, -e.profundidad / 2 + 2.5); sala.castShadow = true;
    const techo = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.25, 5), new THREE.MeshStandardMaterial({ color: '#dfe3e6' }));
    techo.position.set(-1, 3.1, -e.profundidad / 2 + 2.5);
    const ladrillo = new THREE.Mesh(new THREE.BoxGeometry(3, 2.6, 4), new THREE.MeshStandardMaterial({ color: '#b0583f' }));
    ladrillo.position.set(4.5, 1.3, -e.profundidad / 2 + 2.3);
    g.add(sala, techo, ladrillo);
    // Graderías de concreto al frente y señal de punto de encuentro
    const concreto = new THREE.MeshStandardMaterial({ color: '#cfc9bd' });
    for (let i = 0; i < 3; i++) {
      const grada = new THREE.Mesh(new THREE.BoxGeometry(e.ancho, 0.3 * (i + 1), 0.8), concreto);
      grada.position.set(0, 0.15 * (i + 1), e.profundidad / 2 + 0.4 + (2 - i) * 0.8);
      g.add(grada);
    }
    const pe = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.05),
      new THREE.MeshStandardMaterial({ map: texturaTexto('PE', '#2e9b4f', '#ffffff', 64, 80) }));
    pe.position.set(e.ancho / 2 - 1, 2, 2);
    const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2, 6), new THREE.MeshStandardMaterial({ color: '#cccccc' }));
    poste.position.set(e.ancho / 2 - 1, 1, 2);
    g.add(pe, poste);
    return g;
  }

  /* ---------------------------------------------------------------- Zona genérica */
  #piso(e) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(e.ancho, 0.1, e.profundidad),
      new THREE.MeshStandardMaterial({ color: e.color, roughness: 1 }));
    m.position.y = 0.05; m.receiveShadow = true;
    g.add(m);
    return g;
  }

  /* ---------------------------------------------------------------- Sótanos conectados */
  /*
   * Cada sótano es una losa translúcida; dentro se dibujan como cajas de color los recintos que
   * la base de datos tiene en ese nivel (piso negativo), repartidos a lo largo del bloque.
   */
  #sotanos(edificios, lugares) {
    const losaMat = new THREE.MeshStandardMaterial({ color: '#5b84b1', transparent: true, opacity: 0.28, depthWrite: false });
    const piso = new THREE.MeshStandardMaterial({ color: '#dfe5ec' });
    const borde = new THREE.LineBasicMaterial({ color: '#dfe9f5' });
    const colores = { CLINICA: '#e2574c', LABORATORIO: '#8e6cc8', OFICINA: '#3d7cc9', SERVICIO: '#2fa37a', SEGURIDAD: '#e0a526' };
    for (const e of edificios) {
      for (let s = 1; s <= e.sotanos; s++) {
        const y0 = -s * SEPARACION_SOTANOS;
        const nivel = new THREE.Mesh(new THREE.BoxGeometry(e.ancho, ALTURA_SOTANO - 0.3, e.profundidad), losaMat);
        nivel.position.set(e.x, y0 + ALTURA_SOTANO / 2, e.z);
        nivel.userData.id = e.id;
        const losa = new THREE.Mesh(new THREE.BoxGeometry(e.ancho, 0.2, e.profundidad), piso);
        losa.position.set(e.x, y0 + 0.1, e.z);
        losa.userData.id = e.id;
        const aristas = new THREE.LineSegments(new THREE.EdgesGeometry(nivel.geometry), borde);
        aristas.position.copy(nivel.position);
        this.grupoSotanos.add(nivel, losa, aristas);

        const nombreNivel = e.codigo === 'B' && s === 1 ? 'Piso 0 (sótano 1)' : `Sótano ${s}`;
        this.#etiqueta(`${e.nombre} · ${nombreNivel}`, new THREE.Vector3(e.x - e.ancho / 2, y0 + 3.2, e.z + e.profundidad / 2), 'etiqueta-nivel', this.grupoSotanos);

        // Recintos de este nivel
        const aqui = lugares.filter(l => l.edificioId === e.id && l.piso === -s && l.tipo !== 'CIRCULACION');
        if (!aqui.length) continue;
        const largo = Math.max(e.ancho, e.profundidad), corto = Math.min(e.ancho, e.profundidad);
        const aLoLargoDeZ = e.profundidad >= e.ancho;
        const filas = aqui.length > 2 ? 2 : 1;
        const porFila = Math.ceil(aqui.length / filas);
        const celda = (largo - 2) / porFila, ancho = (corto - 2) / filas;
        aqui.forEach((l, i) => {
          const f = Math.floor(i / porFila), c = i % porFila;
          const a = -largo / 2 + 1 + celda * (c + 0.5), b = -corto / 2 + 1 + ancho * (f + 0.5);
          const recinto = new THREE.Mesh(
            new THREE.BoxGeometry(aLoLargoDeZ ? ancho - 0.8 : celda - 0.8, 2, aLoLargoDeZ ? celda - 0.8 : ancho - 0.8),
            new THREE.MeshStandardMaterial({ color: colores[l.tipo] ?? '#7d8b99', transparent: true, opacity: 0.85 }));
          recinto.position.set(e.x + (aLoLargoDeZ ? b : a), y0 + 1.2, e.z + (aLoLargoDeZ ? a : b));
          recinto.userData.id = e.id;
          this.grupoSotanos.add(recinto);
          this.#etiqueta(l.nombre.replace(' de la Clínica Odontológica', '').replace(' de la clínica', ''), recinto.position.clone().add(new THREE.Vector3(0, 1.3 + (i % 2) * 1.6, 0)), 'etiqueta-sotano', this.grupoSotanos);
        });
      }
    }
    // Conexión subterránea entre bloques
    if (edificios.length >= 2) {
      const [a, b] = edificios;
      const yT = -SEPARACION_SOTANOS + 1.3;
      const inicio = new THREE.Vector3(a.x, yT, a.z);
      const fin = new THREE.Vector3(b.x, yT, b.z);
      const largo = inicio.distanceTo(fin);
      const tunel = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, largo), new THREE.MeshStandardMaterial({ color: '#f0b429', transparent: true, opacity: 0.6 }));
      tunel.position.copy(inicio).lerp(fin, 0.5);
      tunel.lookAt(fin);
      this.grupoSotanos.add(tunel);
      this.#etiqueta('Conexión subterránea A–B', tunel.position.clone().add(new THREE.Vector3(0, 2, 0)), 'etiqueta-sotano', this.grupoSotanos);
    }
  }

  alternarSotanos() {
    this.sotanosVisibles = !this.sotanosVisibles;
    this.grupoSotanos.visible = this.sotanosVisibles;
    this.barrio.visible = !this.sotanosVisibles;
    this.contenedor.classList.toggle('modo-sotanos', this.sotanosVisibles);
    for (const b of this.bloques.values())
      if (b.datos.tipo !== 'EDIFICIO') b.grupo.visible = !this.sotanosVisibles;
    for (const m of this.suelos) {
      m.transparent = this.sotanosVisibles;
      m.opacity = this.sotanosVisibles ? 0.35 : 1;
      m.depthWrite = !this.sotanosVisibles;
      m.needsUpdate = true;
    }
    // Los edificios se vuelven translúcidos para ver los niveles subterráneos
    for (const b of this.bloques.values()) {
      b.materiales.forEach(m => {
        if (m.userData.opacidad === undefined) m.userData.opacidad = m.transparent ? m.opacity : 1;
        m.transparent = this.sotanosVisibles || m.userData.opacidad < 1;
        m.opacity = this.sotanosVisibles ? Math.min(0.22, m.userData.opacidad) : m.userData.opacidad;
        m.depthWrite = !this.sotanosVisibles;
        m.needsUpdate = true;
      });
    }
    this.controles.maxPolarAngle = this.sotanosVisibles ? Math.PI * 0.62 : Math.PI * 0.47;
    if (this.sotanosVisibles) this.#volar(VISTA_SOTANOS.objetivo.clone(), VISTA_SOTANOS.camara.clone());
    else this.vistaGeneral();
    return this.sotanosVisibles;
  }

  /* ================================================================ Interacción */
  seleccionar(id) {
    this.deseleccionar();
    const b = this.bloques.get(id);
    if (!b) return;
    this.seleccionado = id;
    b.materiales.forEach(m => m.emissive.set('#16273d'));
    b.etiqueta.classList.add('activa');

    const d = b.datos;
    const destino = new THREE.Vector3(d.x, d.tipo === 'EDIFICIO' ? d.pisos * ALTURA_PISO * 0.4 : 0, d.z);
    const distancia = Math.max(d.ancho, d.profundidad, 20) * 1.9;
    this.#volar(destino, destino.clone().add(new THREE.Vector3(distancia * 0.75, distancia * 0.8, distancia)));
  }

  deseleccionar() {
    if (!this.seleccionado) return;
    const b = this.bloques.get(this.seleccionado);
    b.materiales.forEach(m => m.emissive.set('#000000'));
    b.etiqueta.classList.remove('activa');
    this.seleccionado = null;
  }

  /** Detiene el dibujo del mapa mientras se recorre un interior (ahorra batería). */
  pausar(pausa) {
    this.renderer.setAnimationLoop(pausa ? null : () => this.#cuadro());
  }

  vistaGeneral() {
    this.#volar(VISTA_GENERAL.objetivo.clone(), VISTA_GENERAL.camara.clone());
  }

  #volar(objetivo, camara) {
    this.animacion = {
      t: 0,
      desdeObjetivo: this.controles.target.clone(), haciaObjetivo: objetivo,
      desdeCamara: this.camara.position.clone(), haciaCamara: camara,
    };
  }

  #eventos() {
    const raycaster = new THREE.Raycaster();
    const puntero = new THREE.Vector2();
    let inicio = null;

    const tocar = (ev) => {
      const r = this.renderer.domElement.getBoundingClientRect();
      puntero.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(puntero, this.camara);
      const objetos = [...this.bloques.values()].map(b => b.grupo);
      if (this.sotanosVisibles) objetos.push(this.grupoSotanos);
      const hit = raycaster.intersectObjects(objetos, true).find(h => h.object.userData.id);
      return hit ? hit.object.userData.id : null;
    };

    const lienzo = this.renderer.domElement;
    lienzo.addEventListener('pointerdown', ev => (inicio = { x: ev.clientX, y: ev.clientY }));
    lienzo.addEventListener('pointerup', ev => {
      if (!inicio || Math.hypot(ev.clientX - inicio.x, ev.clientY - inicio.y) > 6) return;
      const id = tocar(ev);
      if (id) this.alSeleccionar?.(id);
    });
    lienzo.addEventListener('pointermove', ev => {
      lienzo.style.cursor = tocar(ev) ? 'pointer' : 'grab';
    });

    window.addEventListener('resize', () => {
      const { clientWidth: w, clientHeight: h } = this.contenedor;
      this.camara.aspect = w / h;
      this.camara.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.etiquetas.setSize(w, h);
    });
  }

  #cuadro() {
    if (this.animacion) {
      const a = this.animacion;
      a.t = Math.min(1, a.t + 0.022);
      const k = 1 - Math.pow(1 - a.t, 3);
      this.controles.target.lerpVectors(a.desdeObjetivo, a.haciaObjetivo, k);
      this.camara.position.lerpVectors(a.desdeCamara, a.haciaCamara, k);
      if (a.t === 1) this.animacion = null;
    }
    this.controles.update();
    this.renderer.render(this.escena, this.camara);
    this.etiquetas.render(this.escena, this.camara);
  }
}

/* ==================================================================== Texturas y vegetación */

/** Fachada de ladrillo con una franja de ventanas por piso (y bahías de vidrio para el Bloque B). */
function texturaFachada(anchoMetros, pisos, colorLadrillo, conBahias) {
  const ppm = 12;                                   // píxeles por metro
  const w = Math.min(1024, Math.round(anchoMetros * ppm));
  const h = Math.round(pisos * ALTURA_PISO * ppm);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');

  // Ladrillo
  g.fillStyle = colorLadrillo;
  g.fillRect(0, 0, w, h);
  g.globalAlpha = 0.12;
  for (let y = 0; y < h; y += 4) {
    g.fillStyle = (y / 4) % 2 ? '#000' : '#fff';
    g.fillRect(0, y, w, 1);
  }
  g.globalAlpha = 1;

  const alturaPiso = h / pisos;
  for (let p = 0; p < pisos; p++) {
    const y0 = h - (p + 1) * alturaPiso;
    // Losa
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(0, y0 + alturaPiso - 3, w, 3);
    // Ventanas: en primer piso más grandes (fachada de vidrio)
    const alto = p === 0 ? alturaPiso * 0.62 : alturaPiso * 0.42;
    const yv = y0 + (alturaPiso - alto) / 2;
    const modulo = 54;
    for (let x = 6; x < w - 20; x += modulo) {
      g.fillStyle = '#2c3d4f';
      g.fillRect(x, yv, modulo - 14, alto);
      g.fillStyle = 'rgba(180,210,235,0.35)';
      g.fillRect(x + 2, yv + 2, (modulo - 14) / 2 - 2, alto - 4);
    }
  }
  // Bahías verticales de vidrio (Bloque B)
  if (conBahias) {
    const ancho = 44;
    for (let x = 40; x < w - ancho; x += 120) {
      g.fillStyle = '#354657';
      g.fillRect(x, alturaPiso * 0.25, ancho, h - alturaPiso * 1.1);
      g.strokeStyle = '#8796a3';
      g.lineWidth = 2;
      for (let y = alturaPiso * 0.25; y < h - alturaPiso; y += alturaPiso / 2) {
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + ancho, y); g.stroke();
      }
      g.beginPath(); g.moveTo(x + ancho / 2, alturaPiso * 0.25); g.lineTo(x + ancho / 2, h - alturaPiso * 0.85); g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const matTronco = new THREE.MeshStandardMaterial({ color: '#8a6a48' });
const matHoja = new THREE.MeshStandardMaterial({ color: '#4f8f45', side: THREE.DoubleSide });
const matArbusto = new THREE.MeshStandardMaterial({ color: '#5f9a4f', flatShading: true });

function palma(x, z) {
  const g = new THREE.Group();
  const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 5, 6), matTronco);
  tronco.position.y = 2.5;
  tronco.castShadow = true;
  g.add(tronco);
  for (let i = 0; i < 7; i++) {
    const hoja = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.6, 4), matHoja);
    hoja.position.y = 5;
    hoja.rotation.set(Math.PI / 2.6, (i / 7) * Math.PI * 2, 0, 'YXZ');
    hoja.translateY(1.2);
    hoja.castShadow = true;
    g.add(hoja);
  }
  g.position.set(x, 0, z);
  return g;
}

function arbusto(x, z) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), matArbusto);
  m.position.set(x, 0.8, z);
  m.scale.set(1.1, 0.8, 1.1);
  m.castShadow = true;
  return m;
}




/* ==================================================================== Texturas del pabellón y exteriores */

function lienzo(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return [cv, cv.getContext('2d')];
}
function aTextura(cv, repetir) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repetir) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repetir); }
  return t;
}

function texturaTexto(texto, fondo, color, w = 256, h = 80) {
  const [cv, g] = lienzo(w, h);
  g.fillStyle = fondo; g.fillRect(0, 0, w, h);
  g.fillStyle = color; g.font = `bold ${Math.round(h * 0.45)}px sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(texto, w / 2, h / 2);
  return aTextura(cv);
}

/** Ladrillo en espina de pescado de la plaza de entrada. */
function texturaEspina() {
  const [cv, g] = lienzo(128, 128);
  g.fillStyle = '#b97a5c'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(80,40,25,0.35)'; g.lineWidth = 1.5;
  for (let i = -128; i < 256; i += 16) {
    for (let j = 0; j < 128; j += 32) {
      g.strokeRect(i + j / 2, j, 16, 8);
      g.strokeRect(i + j / 2 + 8, j + 8, 8, 16);
    }
  }
  return aTextura(cv, [6, 2]);
}

/** Adoquín ecológico (concreto con pasto) de rampas y plazoletas. */
function texturaAdoquinGrama() {
  const [cv, g] = lienzo(64, 64);
  g.fillStyle = '#9c968c'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#6d8f4e';
  for (let x = 4; x < 64; x += 16) for (let y = 4; y < 64; y += 16) g.fillRect(x, y, 8, 8);
  return aTextura(cv, [6, 8]);
}

/** Baldosa gris con juntas en diagonal del sendero. */
function texturaBaldosaDiagonal(largo) {
  const [cv, g] = lienzo(128, 128);
  g.fillStyle = '#c9c5bf'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(90,90,90,0.35)'; g.lineWidth = 1.5;
  for (let i = -128; i < 256; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke();
    g.beginPath(); g.moveTo(i + 128, 0); g.lineTo(i, 128); g.stroke();
  }
  return aTextura(cv, [1, Math.round(largo / 5)]);
}

/** Aviso blanco con el logo y las letras de la universidad. */
function texturaAviso() {
  const [cv, g] = lienzo(320, 210);
  g.fillStyle = '#f7f8f8'; g.fillRect(0, 0, 320, 210);
  // logotipo: U azul y C verde concéntricas
  g.lineWidth = 16; g.lineCap = 'butt';
  g.strokeStyle = '#2f9fd8';
  g.beginPath(); g.moveTo(128, 20); g.lineTo(128, 78); g.arc(152, 78, 24, Math.PI, 0, true); g.lineTo(176, 40); g.stroke();
  g.strokeStyle = '#7dbb3f'; g.lineWidth = 12;
  g.beginPath(); g.arc(186, 54, 18, Math.PI * 0.3, Math.PI * 1.7, false); g.stroke();
  g.fillStyle = '#4b5258'; g.textAlign = 'center';
  g.font = '600 20px sans-serif'; g.fillText('U N I V E R S I D A D', 160, 135);
  g.font = 'bold 34px sans-serif'; g.fillText('COOPERATIVA', 160, 170);
  g.font = '600 18px sans-serif'; g.fillText('D E   C O L O M B I A', 160, 196);
  return aTextura(cv);
}

/** Logo en línea para la fachada del Bloque A. */
function texturaLogoLinea() {
  const [cv, g] = lienzo(360, 88);
  g.clearRect(0, 0, 360, 88);
  g.lineWidth = 9; g.strokeStyle = '#2f9fd8';
  g.beginPath(); g.moveTo(14, 12); g.lineTo(14, 48); g.arc(30, 48, 16, Math.PI, 0, true); g.lineTo(46, 22); g.stroke();
  g.strokeStyle = '#7dbb3f'; g.lineWidth = 7;
  g.beginPath(); g.arc(54, 34, 12, Math.PI * 0.3, Math.PI * 1.7); g.stroke();
  g.fillStyle = '#3b4248'; g.font = '600 26px sans-serif';
  g.fillText('Universidad Cooperativa', 80, 38);
  g.fillText('de Colombia', 80, 70);
  return aTextura(cv);
}

/** Vitrina con afiches institucionales (lado izquierdo de la entrada). */
function texturaAfiches() {
  const [cv, g] = lienzo(512, 160);
  g.fillStyle = '#2d3f4f'; g.fillRect(0, 0, 512, 160);
  const colores = ['#f4d35e', '#5a8fb8', '#1e88a8', '#e9eef2'];
  for (let i = 0; i < 4; i++) {
    g.fillStyle = colores[i]; g.fillRect(12 + i * 125, 10, 112, 140);
    g.fillStyle = 'rgba(20,40,60,0.75)'; g.fillRect(22 + i * 125, 40, 90, 10); g.fillRect(22 + i * 125, 58, 70, 8);
  }
  return aTextura(cv);
}

/** Locales de la entrada: Comuna (créditos) y Bonne Vie. */
function texturaLocales() {
  const [cv, g] = lienzo(512, 160);
  g.fillStyle = '#e9edef'; g.fillRect(0, 0, 512, 160);
  g.strokeStyle = '#7d8790'; g.lineWidth = 4;
  for (let x = 0; x <= 512; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 160); g.stroke(); }
  g.fillStyle = '#2e8b57'; g.font = 'bold 18px sans-serif';
  ['Crédito', 'Estudiantil', 'Credi', 'Aportes'].forEach((t, i) => g.fillText(t, 14 + (i % 2) * 64, 60 + Math.floor(i / 2) * 50));
  g.fillStyle = '#3a4046'; g.fillRect(152, 30, 100, 130);
  g.fillStyle = '#8fd0c3'; g.font = 'bold 20px sans-serif'; g.fillText('comuna', 330, 90);
  g.fillStyle = '#2b2f33'; g.fillRect(400, 0, 112, 34);
  g.fillStyle = '#ffffff'; g.font = 'bold 18px serif'; g.fillText('BONNE VIE', 408, 24);
  return aTextura(cv);
}

/** Cartel de oferta académica (pregrados y posgrados). */
function texturaCartelProgramas() {
  const [cv, g] = lienzo(170, 210);
  g.fillStyle = '#f2f6f4'; g.fillRect(0, 0, 170, 210);
  g.fillStyle = '#1e88b8'; g.fillRect(10, 30, 70, 14);
  g.fillStyle = '#5cb85c'; g.fillRect(92, 30, 70, 14);
  g.fillStyle = '#ffffff'; g.font = 'bold 9px sans-serif';
  g.fillText('PREGRADOS', 18, 41); g.fillText('POSGRADOS', 100, 41);
  g.fillStyle = '#5b6770';
  for (let i = 0; i < 10; i++) { g.fillRect(12, 56 + i * 13, 50, 3); g.fillRect(94, 56 + i * 13, 54, 3); }
  g.fillStyle = '#2e8b57'; g.fillRect(0, 194, 170, 16);
  return aTextura(cv);
}

/* ==================================================================== Mobiliario y vegetación extra */

const matCipres = new THREE.MeshStandardMaterial({ color: '#2f5b3b', roughness: 1, flatShading: true });
function cipres(x, z, alto) {
  const g = new THREE.Group();
  const copa = new THREE.Mesh(new THREE.ConeGeometry(0.75, alto, 8), matCipres);
  copa.position.y = alto / 2 + 0.4;
  copa.castShadow = true;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.6, 6), matTronco);
  base.position.y = 0.3;
  g.add(copa, base);
  g.position.set(x, 0, z);
  return g;
}

const matFlor = [new THREE.MeshStandardMaterial({ color: '#e05c9a' }), new THREE.MeshStandardMaterial({ color: '#f0f0f0' })];
function flores(x, z) {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 4), matFlor[i % 2]);
    f.position.set(x + (i - 1) * 0.5, 0.45, z + (i % 2) * 0.6);
    g.add(f);
  }
  return g;
}

const matPoste = new THREE.MeshStandardMaterial({ color: '#b8bfc4', metalness: 0.5 });
function poste(x, z) {
  const g = new THREE.Group();
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 7, 8), matPoste);
  p.position.y = 3.5;
  const brazo = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 0.25), matPoste);
  brazo.position.set(0.8, 6.9, 0);
  g.add(p, brazo);
  g.position.set(x, 0, z);
  return g;
}

const matMesa = new THREE.MeshStandardMaterial({ color: '#4a4f54' });
const matSilla = new THREE.MeshStandardMaterial({ color: '#eceeee' });
function mesa(x, z, conParasol) {
  const g = new THREE.Group();
  const tablero = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 1.2), conParasol ? matSilla : matMesa);
  tablero.position.y = 0.75;
  const pata = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.75, 6), matMesa);
  pata.position.y = 0.37;
  g.add(tablero, pata);
  for (const [dx, dz] of [[0.9, 0], [-0.9, 0], [0, 0.9], [0, -0.9]]) {
    const silla = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.5), conParasol ? matSilla : matMesa);
    silla.position.set(dx, 0.45, dz);
    g.add(silla);
  }
  if (conParasol) {
    const asta = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 6), matMesa);
    asta.position.y = 1.3;
    const lona = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.6, 8), new THREE.MeshStandardMaterial({ color: '#8f8a85' }));
    lona.position.y = 2.6;
    g.add(asta, lona);
  }
  g.position.set(x, 0, z);
  return g;
}

const matBici = new THREE.MeshStandardMaterial({ color: '#f4f4f4' });
const matRueda = new THREE.MeshStandardMaterial({ color: '#222222' });
function bicicleta(x, z) {
  const g = new THREE.Group();
  for (const dz of [-0.55, 0.55]) {
    const rueda = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.04, 6, 16), matRueda);
    rueda.rotation.y = Math.PI / 2;
    rueda.position.set(0, 0.35, dz);
    g.add(rueda);
  }
  const cuadro = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 1.1), matBici);
  cuadro.position.y = 0.6;
  const canasta = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.25), matBici);
  canasta.position.set(0, 0.85, 0.6);
  g.add(cuadro, canasta);
  g.position.set(x, 0, z);
  return g;
}
