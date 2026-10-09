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
const CALLE_18_Z = 40;     // eje de la Calle 18
const CARRERA_45_X = 54;   // eje de la Carrera 45
const VISTA_GENERAL = { camara: new THREE.Vector3(-58, 52, 88), objetivo: new THREE.Vector3(10, 6, -10) };
const VISTA_SOTANOS = { camara: new THREE.Vector3(-62, 26, 52), objetivo: new THREE.Vector3(10, -4, -14) };

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
      else grupo = this.#plazoleta(e);

      grupo.position.set(e.x, 0, e.z);
      grupo.traverse(o => { o.userData.id = e.id; });
      this.escena.add(grupo);

      const altura = e.tipo === 'EDIFICIO' ? e.pisos * ALTURA_PISO + 8 : e.tipo === 'ACCESO' ? 8.5 : 2;
      const etiqueta = this.#etiqueta(e.nombre, new THREE.Vector3(0, altura, 0), 'etiqueta-3d', grupo);

      const materiales = [];
      grupo.traverse(o => {
        const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        ms.forEach(m => { if (m.emissive && !materiales.includes(m)) materiales.push(m); });
      });
      this.bloques.set(e.id, { grupo, etiqueta, datos: e, materiales });
    }
    this.#sotanos(edificios.filter(e => e.tipo === 'EDIFICIO' && e.sotanos > 0));
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
    return grupo;
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
  #acceso(e) {
    const grupo = new THREE.Group();
    const vidrio = new THREE.MeshStandardMaterial({ color: '#a9c7d8', transparent: true, opacity: 0.45, roughness: 0.1, metalness: 0.3 });
    const acero = new THREE.MeshStandardMaterial({ color: '#8d969d', metalness: 0.6, roughness: 0.4 });
    const caja = new THREE.Mesh(new THREE.BoxGeometry(e.ancho, 4.2, e.profundidad), vidrio);
    caja.position.y = 2.1;
    grupo.add(caja);

    // Cubierta inclinada (sube hacia el oriente, como en la foto)
    const forma = new THREE.Shape();
    forma.moveTo(-e.ancho / 2 - 1, 4.2);
    forma.lineTo(e.ancho / 2 + 1, 4.2);
    forma.lineTo(e.ancho / 2 + 1, 7.4);
    forma.lineTo(-e.ancho / 2 - 1, 4.8);
    forma.closePath();
    const cubierta = new THREE.Mesh(new THREE.ExtrudeGeometry(forma, { depth: e.profundidad + 2, bevelEnabled: false }), acero);
    cubierta.position.z = -(e.profundidad + 2) / 2;
    cubierta.castShadow = true;
    grupo.add(cubierta);

    // Columnas
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.3, 6, 0.3), acero);
      c.position.set(sx * (e.ancho / 2), 3, sz * (e.profundidad / 2));
      grupo.add(c);
    }
    // Aviso con el logo
    const aviso = new THREE.Mesh(new THREE.BoxGeometry(5, 3.2, 0.2), [
      acero, acero, acero, acero,
      new THREE.MeshStandardMaterial({ map: texturaAviso() }), acero,
    ]);
    aviso.position.set(e.ancho / 2 - 4.5, 4.6, e.profundidad / 2 + 1.1);
    grupo.add(aviso);
    // Tapete de ladrillo frente al acceso
    const tapete = new THREE.Mesh(new THREE.BoxGeometry(e.ancho + 6, 0.08, 7), new THREE.MeshStandardMaterial({ color: '#a8604a' }));
    tapete.position.set(0, 0.05, e.profundidad / 2 + 3.5);
    tapete.receiveShadow = true;
    grupo.add(tapete);
    return grupo;
  }

  /* ---------------------------------------------------------------- Plazoleta y sendero */
  #plazoleta(e) {
    const grupo = new THREE.Group();
    const adoquin = new THREE.Mesh(new THREE.BoxGeometry(e.ancho, 0.1, e.profundidad),
      new THREE.MeshStandardMaterial({ color: '#c8cbc4', roughness: 1 }));
    adoquin.position.y = 0.05;
    adoquin.receiveShadow = true;
    const sendero = new THREE.Mesh(new THREE.BoxGeometry(4, 0.12, e.profundidad),
      new THREE.MeshStandardMaterial({ color: '#e4e1da', roughness: 1 }));
    sendero.position.set(e.ancho / 2 - 7, 0.08, 0);
    const jardin = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, e.profundidad - 4),
      new THREE.MeshStandardMaterial({ color: e.color, roughness: 1 }));
    jardin.position.set(e.ancho / 2 - 3.6, 0.15, 0);
    const jardin2 = jardin.clone();
    jardin2.position.x = -e.ancho / 2 + 3;
    grupo.add(adoquin, sendero, jardin, jardin2);
    for (let z = -e.profundidad / 2 + 3; z < e.profundidad / 2 - 2; z += 6) {
      grupo.add(palma(e.ancho / 2 - 3.6, z));
      grupo.add(arbusto(-e.ancho / 2 + 3, z + 3));
    }
    return grupo;
  }

  /* ---------------------------------------------------------------- Sótanos conectados */
  #sotanos(edificios) {
    const mat = new THREE.MeshStandardMaterial({ color: '#5b84b1', transparent: true, opacity: 0.85 });
    const losa = new THREE.LineBasicMaterial({ color: '#dfe9f5' });
    for (const e of edificios) {
      for (let s = 1; s <= e.sotanos; s++) {
        const nivel = new THREE.Mesh(new THREE.BoxGeometry(e.ancho, ALTURA_SOTANO - 0.3, e.profundidad), mat);
        nivel.position.set(e.x, -s * ALTURA_SOTANO + ALTURA_SOTANO / 2, e.z);
        nivel.userData.id = e.id;
        const borde = new THREE.LineSegments(new THREE.EdgesGeometry(nivel.geometry), losa);
        borde.position.copy(nivel.position);
        this.grupoSotanos.add(nivel, borde);
        const lado = e.x < 10 ? -1 : 1;   // etiqueta hacia afuera del campus
        this.#etiqueta(`${e.nombre} · Sótano ${s}`, new THREE.Vector3(e.x + lado * (e.ancho / 2 + 3), nivel.position.y, e.z), 'etiqueta-mini', this.grupoSotanos);
      }
    }
    // Conexión subterránea entre bloques
    if (edificios.length >= 2) {
      const [a, b] = edificios;
      const inicio = new THREE.Vector3(a.x, -ALTURA_SOTANO / 2, a.z);
      const fin = new THREE.Vector3(b.x, -ALTURA_SOTANO / 2, b.z);
      const largo = inicio.distanceTo(fin);
      const tunel = new THREE.Mesh(new THREE.BoxGeometry(4, 2.6, largo), new THREE.MeshStandardMaterial({ color: '#f0b429', transparent: true, opacity: 0.85 }));
      tunel.position.copy(inicio).lerp(fin, 0.5);
      tunel.lookAt(fin);
      this.grupoSotanos.add(tunel);
      this.#etiqueta('Conexión subterránea A–B', tunel.position.clone().add(new THREE.Vector3(0, -2.2, 0)), 'etiqueta-mini', this.grupoSotanos);
    }
  }

  alternarSotanos() {
    this.sotanosVisibles = !this.sotanosVisibles;
    this.grupoSotanos.visible = this.sotanosVisibles;
    this.barrio.visible = !this.sotanosVisibles;
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

function texturaAviso() {
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 164;
  const g = cv.getContext('2d');
  g.fillStyle = '#f7f9fb'; g.fillRect(0, 0, 256, 164);
  g.fillStyle = '#1f6fb2'; g.fillRect(98, 18, 22, 50);
  g.fillStyle = '#5bb36b'; g.fillRect(124, 18, 22, 50);
  g.fillStyle = '#1d3557';
  g.font = 'bold 20px sans-serif'; g.textAlign = 'center';
  g.fillText('UNIVERSIDAD', 128, 98);
  g.fillText('COOPERATIVA', 128, 122);
  g.font = 'bold 15px sans-serif';
  g.fillText('DE COLOMBIA', 128, 144);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
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



