import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { INTERIORES } from './planos.js';

/*
 * Recorrido en primera persona por el interior de los bloques.
 * Cada piso se arma a partir de un "plano" (planos.js) usando el Kit de construcción de abajo:
 * muros, vidrieras, escaleras, muebles y letreros. El motor se encarga de la cámara,
 * las colisiones, subir/bajar escaleras, el cambio de piso, el minimapa y el menú "Ir a".
 */

export const ALTO = 3;          // altura libre de cada piso (m)
const OJOS = 1.6;               // altura de los ojos
const RADIO = 0.3;              // radio del visitante para colisiones
const VELOCIDAD = 2.4;          // m/s caminando
const GIRO = 1.9;               // rad/s con las flechas

export const tieneInterior = (codigo) => Boolean(INTERIORES[codigo]);

/** Busca el destino interior que corresponde a un lugar de la base de datos. */
export function destinoDeLugar(codigoEdificio, nombreLugar) {
  const edificio = INTERIORES[codigoEdificio];
  if (!edificio) return null;
  const n = normalizar(nombreLugar);
  for (const nivel of edificio.niveles)
    for (const d of nivel.destinos ?? [])
      if ((d.lugares ?? []).some(l => normalizar(l) === n)) return { nivel: nivel.id, destino: d.id };
  return null;
}

/** Busca, en un texto libre (respuesta de Coopi), el primer lugar con interior que se mencione. */
export function destinoEnTexto(codigoEdificio, texto) {
  const edificio = INTERIORES[codigoEdificio];
  if (!edificio) return null;
  const t = normalizar(texto);
  let mejor = null;
  for (const nivel of edificio.niveles)
    for (const d of nivel.destinos ?? [])
      for (const l of [...(d.lugares ?? []), ...(d.claves ?? [])]) {
        const pos = t.indexOf(normalizar(l));
        if (pos >= 0 && (!mejor || pos < mejor.pos)) mejor = { pos, nivel: nivel.id, destino: d.id, nombre: d.nombre };
      }
  return mejor;
}

function normalizar(s) {
  return String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/* ======================================================================== Motor */
export class Recorrido {
  constructor({ alSalir } = {}) {
    this.alSalir = alSalir;
    this.dom = {
      raiz: document.getElementById('recorrido'),
      escena: document.getElementById('recorrido-escena'),
      edificio: document.getElementById('rec-edificio'),
      nivel: document.getElementById('rec-nivel'),
      niveles: document.getElementById('rec-niveles'),
      destinos: document.getElementById('rec-destinos'),
      plano: document.getElementById('rec-plano'),
      fundido: document.getElementById('rec-fundido'),
      lugar: document.getElementById('rec-lugar'),
    };
    this.teclas = new Set();
    this.yaw = 0; this.pitch = 0;
    this.pos = new THREE.Vector2();
    this.objetivo = null;
    this.iniciado = false;
  }

  /* ---------------------------------------------------------------- abrir / cerrar */
  abrir(codigo, nivelId, destinoId) {
    const edificio = INTERIORES[codigo];
    if (!edificio) return;
    if (!this.iniciado) this.#iniciar();
    this.edificio = edificio;
    this.codigo = codigo;
    this.dom.raiz.hidden = false;
    this.dom.edificio.textContent = edificio.nombre;
    this.dom.niveles.innerHTML = edificio.niveles
      .map(n => `<button type="button" data-nivel="${n.id}">${n.corto}</button>`).join('');
    this.#redimensionar();
    this.#cargarNivel(nivelId ?? edificio.niveles[0].id, destinoId);
    this.reloj.start();
    this.renderer.setAnimationLoop(() => this.#cuadro());
  }

  cerrar() {
    this.dom.raiz.hidden = true;
    this.renderer?.setAnimationLoop(null);
    this.teclas.clear();
    this.alSalir?.();
  }

  get abierto() { return !this.dom.raiz.hidden; }

  /** Va a un destino (con fundido), cambiando de piso si hace falta. */
  irA(nivelId, destinoId) {
    this.#fundido(() => {
      if (nivelId !== this.nivel.id) this.#cargarNivel(nivelId, destinoId);
      else this.#ubicar(this.kit.destinos.find(d => d.id === destinoId));
    });
  }

  /* ---------------------------------------------------------------- inicialización */
  #iniciar() {
    this.iniciado = true;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.dom.escena.appendChild(this.renderer.domElement);

    this.etiquetas = new CSS2DRenderer();
    Object.assign(this.etiquetas.domElement.style, { position: 'absolute', top: '0', pointerEvents: 'none' });
    this.dom.escena.appendChild(this.etiquetas.domElement);

    this.camara = new THREE.PerspectiveCamera(72, 1, 0.05, 120);
    this.camara.rotation.order = 'YXZ';
    this.reloj = new THREE.Clock(false);
    this.raycaster = new THREE.Raycaster();

    window.addEventListener('resize', () => this.abierto && this.#redimensionar());

    // Mirar arrastrando · clic en el piso para caminar hasta ese punto
    const lienzo = this.renderer.domElement;
    let ini = null, ultimo = null;
    lienzo.addEventListener('pointerdown', ev => {
      ini = ultimo = { x: ev.clientX, y: ev.clientY };
      lienzo.setPointerCapture(ev.pointerId);
    });
    lienzo.addEventListener('pointermove', ev => {
      if (!ultimo) return;
      this.yaw += (ev.clientX - ultimo.x) * 0.004;
      this.pitch = THREE.MathUtils.clamp(this.pitch + (ev.clientY - ultimo.y) * 0.003, -1.1, 1.1);
      ultimo = { x: ev.clientX, y: ev.clientY };
    });
    lienzo.addEventListener('pointerup', ev => {
      const clic = ini && Math.hypot(ev.clientX - ini.x, ev.clientY - ini.y) < 6;
      ini = ultimo = null;
      if (clic) this.#clicEnEscena(ev);
    });

    // Teclado
    window.addEventListener('keydown', ev => {
      if (!this.abierto || ev.target.closest?.('input, textarea, select')) return;
      const k = ev.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        this.teclas.add(k); this.objetivo = null; ev.preventDefault();
      }
      if (k === 'escape') this.cerrar();
    });
    window.addEventListener('keyup', ev => this.teclas.delete(ev.key.toLowerCase()));

    // Controles en pantalla (celular)
    document.querySelectorAll('[data-tecla]').forEach(b => {
      const k = b.dataset.tecla;
      b.addEventListener('pointerdown', e => { e.preventDefault(); this.teclas.add(k); this.objetivo = null; });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => b.addEventListener(t, () => this.teclas.delete(k)));
    });

    this.dom.niveles.addEventListener('click', ev => {
      const b = ev.target.closest('[data-nivel]');
      if (!b) return;
      const id = Number(b.dataset.nivel);
      if (id !== this.nivel.id) this.#fundido(() => this.#cargarNivel(id));
      b.blur();
    });
    this.dom.destinos.addEventListener('change', () => {
      const [nivel, destino] = this.dom.destinos.value.split('|');
      if (destino) this.irA(Number(nivel), destino);
      this.dom.destinos.value = '';
      this.dom.destinos.blur();   // devuelve el teclado al recorrido
    });
    this.dom.plano.addEventListener('click', ev => this.#clicEnPlano(ev));
    document.getElementById('rec-salir').addEventListener('click', () => this.cerrar());
  }

  #redimensionar() {
    const w = this.dom.escena.clientWidth || window.innerWidth;
    const h = this.dom.escena.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.etiquetas.setSize(w, h);
    this.camara.aspect = w / h;
    this.camara.updateProjectionMatrix();
  }

  /* ---------------------------------------------------------------- pisos */
  #cargarNivel(nivelId, destinoId) {
    const nivel = this.edificio.niveles.find(n => n.id === nivelId) ?? this.edificio.niveles[0];
    if (this.escena) liberar(this.escena);
    this.escena = new THREE.Scene();
    this.escena.background = new THREE.Color('#2a3138');
    this.escena.add(new THREE.HemisphereLight('#ffffff', '#a9adb2', 1.9));
    this.escena.add(new THREE.AmbientLight('#ffffff', 0.75));
    const luz = new THREE.DirectionalLight('#fff7ea', 0.55);
    luz.position.set(3, 10, 6);
    this.escena.add(luz);

    this.kit = new Kit(this.escena, nivel.estilo ?? {});
    this.kit.destinos = nivel.destinos ?? [];
    nivel.construir(this.kit);
    this.kit.finalizar();
    this.nivel = nivel;

    this.dom.nivel.textContent = nivel.nombre;
    this.dom.niveles.querySelectorAll('button').forEach(b => b.classList.toggle('activo', Number(b.dataset.nivel) === nivel.id));
    this.#llenarDestinos();
    this.#prepararPlano();
    const d = this.kit.destinos.find(x => x.id === destinoId) ?? this.kit.destinos[0];
    this.#ubicar(d);
  }

  #llenarDestinos() {
    this.dom.destinos.innerHTML = '<option value="">Ir a…</option>' + this.edificio.niveles.map(n =>
      `<optgroup label="${n.nombre}">${n.destinos.filter(d => !d.oculto).map(d =>
        `<option value="${n.id}|${d.id}">${d.nombre}${d.aproximado ? ' *' : ''}</option>`).join('')}</optgroup>`).join('');
  }

  #ubicar(d) {
    if (!d) return;
    this.pos.set(d.x, d.z);
    this.yaw = d.yaw ?? 0;
    this.pitch = -0.05;
    this.objetivo = null;
    this.#mostrarLugar(d);
  }

  #mostrarLugar(d) {
    this.lugarActual = d.id;
    this.dom.lugar.innerHTML = `<strong>${d.nombre}</strong>${d.nota ? `<span>${d.nota}</span>` : ''}` +
      (d.aproximado ? '<span class="aprox">* Interior aproximado: aún no hay fotos de este espacio.</span>' : '');
    this.dom.lugar.hidden = false;
  }

  #fundido(accion) {
    const f = this.dom.fundido;
    f.classList.add('activo');
    setTimeout(() => { accion(); setTimeout(() => f.classList.remove('activo'), 60); }, 260);
  }

  /* ---------------------------------------------------------------- movimiento y colisiones */
  #cuadro() {
    const dt = Math.min(this.reloj.getDelta(), 0.12);
    const t = this.teclas;
    if (t.has('arrowleft')) this.yaw += GIRO * dt;
    if (t.has('arrowright')) this.yaw -= GIRO * dt;

    const adelante = new THREE.Vector2(-Math.sin(this.yaw), -Math.cos(this.yaw));
    const derecha = new THREE.Vector2(-adelante.y, adelante.x);
    const mov = new THREE.Vector2();
    if (t.has('w') || t.has('arrowup')) mov.add(adelante);
    if (t.has('s') || t.has('arrowdown')) mov.sub(adelante);
    if (t.has('d')) mov.add(derecha);
    if (t.has('a')) mov.sub(derecha);

    if (this.objetivo) {
      const falta = this.objetivo.clone().sub(this.pos);
      if (falta.length() < 0.15) this.objetivo = null;
      else {
        mov.copy(falta.normalize());
        // gira suavemente hacia donde camina
        const yawMeta = Math.atan2(-mov.x, -mov.y);
        let dif = yawMeta - this.yaw;
        dif = Math.atan2(Math.sin(dif), Math.cos(dif));
        this.yaw += dif * Math.min(1, dt * 4);
      }
    }
    if (mov.lengthSq() > 0) {
      mov.normalize().multiplyScalar(VELOCIDAD * dt);
      const antes = this.pos.clone();
      // deslizamiento por ejes para no quedar trabado en las paredes
      if (this.kit.libre(this.pos.x + mov.x, this.pos.y)) this.pos.x += mov.x;
      if (this.kit.libre(this.pos.x, this.pos.y + mov.y)) this.pos.y += mov.y;
      if (this.objetivo && antes.distanceTo(this.pos) < 1e-4) this.objetivo = null;
      this.#revisarPortales();
      this.#revisarLugar();
    }

    const altura = this.kit.alturaEn(this.pos.x, this.pos.y);
    this.camara.position.set(this.pos.x, OJOS + altura, this.pos.y);
    this.camara.rotation.set(this.pitch, this.yaw, 0);
    this.#ocultarRotulosTapados();
    this.renderer.render(this.escena, this.camara);
    this.etiquetas.render(this.escena, this.camara);
    this.#dibujarPlano();
  }

  /** Las etiquetas HTML no se tapan solas: se ocultan si hay un muro entre la cámara y ellas. */
  #ocultarRotulosTapados() {
    this.cuadros = (this.cuadros ?? 0) + 1;
    if (this.cuadros % 8) return;
    const ojo = this.camara.position;
    for (const r of this.kit.rotulos) {
      const dir = r.position.clone().sub(ojo);
      const dist = dir.length();
      let visible = dist < 16;
      if (visible) {
        this.raycaster.set(ojo, dir.normalize());
        this.raycaster.far = dist - 0.3;
        visible = this.raycaster.intersectObjects(this.kit.opacos, false).length === 0;
      }
      r.visible = visible;
    }
    this.raycaster.far = Infinity;
  }

  #revisarPortales() {
    const p = this.kit.portales.find(p => this.pos.x > p.x0 && this.pos.x < p.x1 && this.pos.y > p.z0 && this.pos.y < p.z1);
    if (p && !this.cambiando) {
      this.cambiando = true;
      this.teclas.clear();
      this.objetivo = null;
      this.#fundido(() => { this.#cargarNivel(p.nivel, p.llegada); this.cambiando = false; });
    }
  }

  /** Muestra el nombre del espacio en el que se está (zonas definidas en el plano). */
  #revisarLugar() {
    const z = this.kit.zonas.find(z => this.pos.x > z.x0 && this.pos.x < z.x1 && this.pos.y > z.z0 && this.pos.y < z.z1);
    if (z && z.destino !== this.lugarActual) {
      const d = this.kit.destinos.find(d => d.id === z.destino);
      if (d) this.#mostrarLugar(d);
    }
  }

  #clicEnEscena(ev) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const p = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(p, this.camara);
    const hit = this.raycaster.intersectObjects(this.kit.pisables, false)[0];
    if (hit && hit.distance < 25) this.objetivo = new THREE.Vector2(hit.point.x, hit.point.z);
  }

  /* ---------------------------------------------------------------- minimapa */
  #prepararPlano() {
    const cv = this.dom.plano, g = cv.getContext('2d');
    const { x0, z0, x1, z1 } = this.kit.limites;
    const m = 10;
    this.escalaPlano = Math.min((cv.width - 2 * m) / (x1 - x0), (cv.height - 2 * m) / (z1 - z0));
    this.origenPlano = { x: m + ((cv.width - 2 * m) - (x1 - x0) * this.escalaPlano) / 2 - x0 * this.escalaPlano,
                         y: m + ((cv.height - 2 * m) - (z1 - z0) * this.escalaPlano) / 2 - z0 * this.escalaPlano };
    const base = document.createElement('canvas');
    base.width = cv.width; base.height = cv.height;
    const b = base.getContext('2d');
    const P = (x, z) => [this.origenPlano.x + x * this.escalaPlano, this.origenPlano.y + z * this.escalaPlano];
    b.fillStyle = '#f7f8fa'; b.fillRect(0, 0, cv.width, cv.height);
    b.fillStyle = '#e3e7ec';
    for (const r of this.kit.rectsPiso) { const [a, c] = P(r.x0, r.z0); b.fillRect(a, c, (r.x1 - r.x0) * this.escalaPlano, (r.z1 - r.z0) * this.escalaPlano); }
    b.fillStyle = '#f6d9a8';
    for (const r of this.kit.rampas) { const [a, c] = P(r.x0, r.z0); b.fillRect(a, c, (r.x1 - r.x0) * this.escalaPlano, (r.z1 - r.z0) * this.escalaPlano); }
    b.fillStyle = '#c9ced5';
    for (const o of this.kit.obstaculos) { const [a, c] = P(o.x0, o.z0); b.fillRect(a, c, (o.x1 - o.x0) * this.escalaPlano, (o.z1 - o.z0) * this.escalaPlano); }
    b.strokeStyle = '#3c4650'; b.lineWidth = 1.6;
    for (const s of this.kit.muros) { b.beginPath(); b.moveTo(...P(s.ax, s.az)); b.lineTo(...P(s.bx, s.bz)); b.stroke(); }
    for (const d of this.kit.destinos.filter(d => !d.oculto)) {
      const [a, c] = P(d.x, d.z);
      b.fillStyle = d.aproximado ? '#9aa5b1' : '#1f9bb0';
      b.beginPath(); b.arc(a, c, 3.2, 0, Math.PI * 2); b.fill();
    }
    this.basePlano = base;
  }

  #dibujarPlano() {
    const cv = this.dom.plano, g = cv.getContext('2d');
    g.drawImage(this.basePlano, 0, 0);
    const x = this.origenPlano.x + this.pos.x * this.escalaPlano;
    const y = this.origenPlano.y + this.pos.y * this.escalaPlano;
    g.save();
    g.translate(x, y);
    g.rotate(-this.yaw);
    g.fillStyle = 'rgba(0,77,153,0.18)';
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 22, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6); g.closePath(); g.fill();
    g.fillStyle = '#004d99';
    g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(0, 2.5); g.lineTo(-5, 5); g.closePath(); g.fill();
    g.restore();
  }

  #clicEnPlano(ev) {
    const r = this.dom.plano.getBoundingClientRect();
    const px = (ev.clientX - r.left) * this.dom.plano.width / r.width;
    const py = (ev.clientY - r.top) * this.dom.plano.height / r.height;
    const x = (px - this.origenPlano.x) / this.escalaPlano;
    const z = (py - this.origenPlano.y) / this.escalaPlano;
    // ¿clic sobre un destino? → ir allá; si no, a ese punto si está libre
    const d = this.kit.destinos.find(d => !d.oculto && Math.hypot(d.x - x, d.z - z) < 1.2);
    if (d) return this.irA(this.nivel.id, d.id);
    if (this.kit.libre(x, z)) this.#fundido(() => { this.pos.set(x, z); this.objetivo = null; });
  }
}

function liberar(obj) {
  obj.traverse(o => {
    o.geometry?.dispose();
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    ms.forEach(m => { if (!m.userData.compartido) m.dispose(); });
    if (o.isCSS2DObject) o.element.remove();
  });
}

/* ======================================================================== Kit de construcción */
export class Kit {
  constructor(escena, estilo = {}, soloDatos = false) {
    this.escena = escena;
    this.soloDatos = soloDatos;            // para leer destinos sin construir geometría pesada
    this.estilo = { piso: 'terrazo', muro: 'blanco', lamparas: 'tubo', ...estilo };
    this.muros = []; this.obstaculos = []; this.rectsPiso = []; this.huecos = [];
    this.rampas = []; this.portales = []; this.destinos = []; this.zonas = []; this.pisables = [];
    this.opacos = []; this.rotulos = [];
    this.limites = { x0: -10, z0: -10, x1: 10, z1: 10 };
  }

  /* ---------- datos de navegación */
  limitar(x0, z0, x1, z1) { this.limites = { x0, z0, x1, z1 }; }
  destino(id, nombre, x, z, yaw = 0, extra = {}) { this.destinos.push({ id, nombre, x, z, yaw, ...extra }); }
  zona(destino, x0, z0, x1, z1) { this.zonas.push({ destino, x0, z0, x1, z1 }); }
  portal(x0, z0, x1, z1, nivel, llegada) { this.portales.push({ x0, z0, x1, z1, nivel, llegada }); }
  obstaculo(x0, z0, x1, z1) { this.obstaculos.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) }); }

  libre(x, z) {
    const enRampa = this.rampas.some(r => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
    const sobrePiso = enRampa || (this.rectsPiso.some(r => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1)
      && !this.huecos.some(h => x > h.x0 && x < h.x1 && z > h.z0 && z < h.z1));
    if (!sobrePiso) return false;
    for (const s of this.muros) if (distanciaSegmento(x, z, s) < RADIO) return false;
    for (const o of this.obstaculos)
      if (x > o.x0 - RADIO && x < o.x1 + RADIO && z > o.z0 - RADIO && z < o.z1 + RADIO) return false;
    return true;
  }

  alturaEn(x, z) {
    const r = this.rampas.find(r => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
    if (!r) return 0;
    const t = THREE.MathUtils.clamp((z - r.zIni) / (r.zFin - r.zIni), 0, 1);
    return r.h * t;
  }

  /* ---------- utilidades de geometría */
  add(o) { if (!this.soloDatos) this.escena.add(o); return o; }

  caja(w, h, d, material, x, y, z, padre = null, rotY = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof material === 'string' ? mat(material) : material);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    (padre ?? this.escena).add(m);
    return m;
  }

  /** Coloca un grupo de mueble. Si es sólido, su huella bloquea el paso. */
  colocar(g, x, z, rot = 0, solido = true, y = 0) {
    g.position.set(x, y, z);
    g.rotation.y = rot;
    if (this.soloDatos) return g;
    this.escena.add(g);
    if (solido) {
      g.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(g);
      this.obstaculo(b.min.x, b.min.z, b.max.x, b.max.z);
    }
    return g;
  }

  etiqueta(texto, x, y, z, clase = 'etiqueta-interior') {
    if (this.soloDatos) return;
    const div = document.createElement('div');
    div.className = clase;
    div.textContent = texto;
    const o = new CSS2DObject(div);
    o.position.set(x, y, z);
    this.escena.add(o);
    this.rotulos.push(o);
  }

  /* ---------- pisos y techos (se arman al final, descontando huecos de escaleras) */
  piso(x0, z0, x1, z1, tipo) { this.rectsPiso.push({ x0, z0, x1, z1, tipo: tipo ?? this.estilo.piso }); }

  finalizar() {
    if (this.soloDatos) return;
    for (const r of this.rectsPiso) {
      for (const p of restarHuecos(r, this.huecos)) {
        const w = p.x1 - p.x0, d = p.z1 - p.z0;
        const piso = this.caja(w, 0.1, d, materialPiso(r.tipo, w, d), (p.x0 + p.x1) / 2, -0.05, (p.z0 + p.z1) / 2);
        this.pisables.push(piso);
      }
      const w = r.x1 - r.x0, d = r.z1 - r.z0;
      this.caja(w, 0.1, d, 'techo', (r.x0 + r.x1) / 2, ALTO + 0.05, (r.z0 + r.z1) / 2);
    }
  }

  /* ---------- muros */
  /**
   * Muro recto de A a B. Opciones:
   *  mat: 'blanco' | 'ladrillo' | 'madera' | 'crema'
   *  huecos: [[t0, t1]] tramos (en metros desde A) sin muro, para puertas
   *  ventanas: [[t0, t1]] tramos con ventana (muro abajo y arriba, vidrio al medio)
   *  mostrador: [[t0, t1]] ventanillas de atención (muro bajo + vidrio + repisa)
   */
  muro(ax, az, bx, bz, op = {}) {
    const { mat: m = this.estilo.muro, huecos = [], ventanas = [], mostrador = [], alto = ALTO, grosor = 0.16 } = op;
    const L = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / L, uz = (bz - az) / L;
    const ang = Math.atan2(-(bz - az), bx - ax);
    const tramo = (t0, t1, y0, y1, material) => {
      if (t1 - t0 < 0.01 || y1 - y0 < 0.01 || this.soloDatos) return;
      const largo = t1 - t0, cx = ax + ux * (t0 + largo / 2), cz = az + uz * (t0 + largo / 2);
      const geo = new THREE.BoxGeometry(largo, y1 - y0, grosor);
      uvMundo(geo, largo, y1 - y0, grosor);
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.set(cx, (y0 + y1) / 2, cz);
      mesh.rotation.y = ang;
      this.escena.add(mesh);
      this.opacos.push(mesh);
    };
    const material = materialMuro(m);
    const cortes = [...huecos.map(h => ({ t0: h[0], t1: h[1], tipo: 'hueco' })),
                    ...ventanas.map(h => ({ t0: h[0], t1: h[1], tipo: 'ventana' })),
                    ...mostrador.map(h => ({ t0: h[0], t1: h[1], tipo: 'mostrador' }))].sort((a, b) => a.t0 - b.t0);
    let t = 0;
    const solido = (t0, t1) => this.muros.push({ ax: ax + ux * t0, az: az + uz * t0, bx: ax + ux * t1, bz: az + uz * t1 });
    for (const c of cortes) {
      tramo(t, c.t0, 0, alto, material);
      if (c.t0 > t) solido(t, c.t0);
      if (c.tipo === 'hueco') {
        tramo(c.t0, c.t1, 2.2, alto, material);          // dintel
      } else {
        const bajo = c.tipo === 'mostrador' ? 1.05 : 0.95, alto2 = c.tipo === 'mostrador' ? 2.4 : 2.2;
        tramo(c.t0, c.t1, 0, bajo, material);
        tramo(c.t0, c.t1, alto2, alto, material);
        this.#vidrio(ax + ux * c.t0, az + uz * c.t0, ax + ux * c.t1, az + uz * c.t1, bajo, alto2, false);
        if (c.tipo === 'mostrador' && !this.soloDatos) {
          const largo = c.t1 - c.t0, cx = ax + ux * (c.t0 + largo / 2), cz = az + uz * (c.t0 + largo / 2);
          const repisa = this.caja(largo, 0.04, 0.45, 'acero', cx, bajo + 0.02, cz, null, ang);
          repisa.position.x += -uz * 0.2; repisa.position.z += ux * 0.2;
        }
        solido(c.t0, c.t1);
      }
      t = c.t1;
    }
    tramo(t, L, 0, alto, material);
    if (L > t) solido(t, L);
  }

  /** Vidriera con marcos negros (fachadas y oficinas). huecos = puertas abiertas. */
  vidriera(ax, az, bx, bz, op = {}) {
    const { huecos = [], esmerilado = false, banda = false, desde = 0, hasta = ALTO } = op;
    const L = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / L, uz = (bz - az) / L;
    let t = 0;
    const tramos = [];
    for (const h of [...huecos].sort((a, b) => a[0] - b[0])) { tramos.push([t, h[0]]); t = h[1]; }
    tramos.push([t, L]);
    for (const [t0, t1] of tramos) {
      if (t1 - t0 < 0.05) continue;
      this.muros.push({ ax: ax + ux * t0, az: az + uz * t0, bx: ax + ux * t1, bz: az + uz * t1 });
      this.#vidrio(ax + ux * t0, az + uz * t0, ax + ux * t1, az + uz * t1, desde, hasta, esmerilado, banda);
    }
    for (const h of huecos) {   // dintel sobre la puerta
      const a = [ax + ux * h[0], az + uz * h[0]], b = [ax + ux * h[1], az + uz * h[1]];
      this.#vidrio(a[0], a[1], b[0], b[1], 2.2, hasta, esmerilado, false);
    }
  }

  #vidrio(ax, az, bx, bz, y0, y1, esmerilado, banda) {
    if (this.soloDatos) return;
    const L = Math.hypot(bx - ax, bz - az), ang = Math.atan2(-(bz - az), bx - ax);
    const g = new THREE.Group();
    g.position.set((ax + bx) / 2, 0, (az + bz) / 2);
    g.rotation.y = ang;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(L, y1 - y0, 0.03), mat(esmerilado ? 'esmerilado' : 'vidrio'));
    panel.position.y = (y0 + y1) / 2;
    g.add(panel);
    if (banda) {   // franja esmerilada (privacidad) como en las oficinas de vidrio
      const f = new THREE.Mesh(new THREE.BoxGeometry(L, 0.9, 0.035), mat('esmerilado'));
      f.position.y = Math.min(y1, 1.6) - 0.45;
      g.add(f);
    }
    // Marcos negros: parales cada ~1.2 m y travesaños
    const n = Math.max(1, Math.round(L / 1.2));
    for (let i = 0; i <= n; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, y1 - y0, 0.07), mat('marco'));
      p.position.set(-L / 2 + (L * i) / n, (y0 + y1) / 2, 0);
      g.add(p);
    }
    for (const y of [y0 + 0.03, y1 - 0.03, Math.min(y1 - 0.05, 2.2)]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(L, 0.06, 0.07), mat('marco'));
      r.position.y = y;
      g.add(r);
    }
    this.escena.add(g);
  }

  /** Mampara esmerilada baja (cubículos de la clínica). */
  mampara(ax, az, bx, bz, alto = 1.8) {
    this.muros.push({ ax, az, bx, bz });
    if (this.soloDatos) return;
    const L = Math.hypot(bx - ax, bz - az), ang = Math.atan2(-(bz - az), bx - ax);
    const m = new THREE.Mesh(new THREE.BoxGeometry(L, alto, 0.03), mat('mampara'));
    m.position.set((ax + bx) / 2, 0.15 + alto / 2, (az + bz) / 2);
    m.rotation.y = ang;
    this.escena.add(m);
    for (const [x, z] of [[ax, az], [bx, bz]]) this.caja(0.05, ALTO, 0.05, 'acero', x, ALTO / 2, z).geometry = new THREE.CylinderGeometry(0.025, 0.025, ALTO, 8);
  }

  /** Puerta (hoja) dibujada; abierta deja ver el hueco, cerrada tapa. */
  puerta(x, z, rot, { ancho = 0.95, color = 'puertaRoja', abierta = true, vidrio = false } = {}) {
    if (this.soloDatos) return;
    const g = new THREE.Group();
    const hoja = new THREE.Group();
    const m = vidrio ? 'vidrio' : color;
    const h = new THREE.Mesh(new THREE.BoxGeometry(ancho, 2.15, 0.05), mat(m));
    h.position.set(ancho / 2, 1.075, 0);
    hoja.add(h);
    if (vidrio) for (const [w, hh, y] of [[0.05, 2.15, 1.075]]) {
      const marco = new THREE.Mesh(new THREE.BoxGeometry(w, hh, 0.07), mat('marco')); marco.position.set(0.03, y, 0); hoja.add(marco);
      const marco2 = marco.clone(); marco2.position.x = ancho - 0.03; hoja.add(marco2);
    }
    const manija = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.06), mat('acero'));
    manija.position.set(ancho - 0.12, 1.05, 0.05);
    hoja.add(manija);
    hoja.position.x = -ancho / 2;
    hoja.rotation.y = abierta ? -1.35 : 0;
    g.add(hoja);
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    this.escena.add(g);
  }

  /* ---------- escaleras (siempre a lo largo de z) */
  /**
   * Escalera entre zIni y zFin. 'sube' sube hacia zFin; 'baja' baja hacia zFin dentro de un foso.
   * Se puede caminar por ella: la cámara sube o baja con los peldaños.
   */
  escalera(x0, x1, zIni, zFin, dir = 'sube', { barandas = [true, true] } = {}) {
    const h = dir === 'sube' ? 2.1 : -2.1;
    const za = Math.min(zIni, zFin), zb = Math.max(zIni, zFin);
    this.rampas.push({ x0, x1, z0: za, z1: zb, zIni, zFin, h });
    if (dir === 'baja') this.huecos.push({ x0, z0: za, x1, z1: zb });
    // laterales no se pueden cruzar
    if (barandas[0]) this.muros.push({ ax: x0, az: zIni, bx: x0, bz: zFin });
    if (barandas[1]) this.muros.push({ ax: x1, az: zIni, bx: x1, bz: zFin });
    this.muros.push({ ax: x0, az: zFin, bx: x1, bz: zFin });
    if (this.soloDatos) return;

    const n = Math.round(Math.abs(zFin - zIni) / 0.3), paso = (zFin - zIni) / n, alzada = h / n;
    const ancho = x1 - x0, cx = (x0 + x1) / 2;
    for (let i = 0; i < n; i++) {
      const z = zIni + paso * (i + 0.5);
      const ySup = dir === 'sube' ? alzada * (i + 1) : alzada * (i + 1);
      const yInf = dir === 'sube' ? 0 : ySup - 0.25;
      const peldano = this.caja(ancho, Math.abs(ySup - yInf), Math.abs(paso), 'peldano', cx, (ySup + yInf) / 2, z);
      peldano.geometry = uvMundo(peldano.geometry, ancho, Math.abs(ySup - yInf), Math.abs(paso), 1);
      this.caja(ancho, 0.02, 0.05, 'marco', cx, ySup + 0.01, zIni + paso * i + Math.sign(paso) * 0.03);
    }
    if (dir === 'baja') {   // paredes del foso y fondo
      for (const x of [x0, x1]) this.caja(0.12, 2.6, Math.abs(zFin - zIni), materialMuro('ladrillo'), x, -1.3, (zIni + zFin) / 2);
      this.caja(ancho, 2.6, 0.12, materialMuro('blanco'), cx, -1.3, zFin);
      this.caja(ancho, 0.1, 1.2, 'peldano', cx, h - 0.05, zFin + Math.sign(paso) * 0.6);
    } else {
      this.caja(ancho, 0.3, Math.abs(zFin - zIni), 'peldano', cx, ALTO - 0.15, (zIni + zFin) / 2).visible = false;
    }
    // barandas metálicas
    for (const [x, ok] of [[x0 + 0.06, barandas[0]], [x1 - 0.06, barandas[1]]]) {
      if (!ok) continue;
      const L = Math.hypot(zFin - zIni, h);
      const riel = this.caja(0.05, 0.05, L, 'marco', x, h / 2 + 0.95, (zIni + zFin) / 2);
      riel.lookAt(x, h + 0.95, zFin);
      for (let i = 0; i <= 4; i++) {
        const t = i / 4;
        this.caja(0.04, 0.95, 0.04, 'marco', x, h * t + 0.47, zIni + (zFin - zIni) * t);
      }
    }
  }

  /* ---------- iluminación del techo */
  lamparas(x0, z0, x1, z1, { paso = 3, eje = 'x', tipo = this.estilo.lamparas } = {}) {
    if (this.soloDatos) return;
    for (let a = (eje === 'x' ? z0 : x0); a <= (eje === 'x' ? z1 : x1) + 0.01; a += paso) {
      for (let b = (eje === 'x' ? x0 : z0); b <= (eje === 'x' ? x1 : z1) + 0.01; b += 2.6) {
        const [x, z] = eje === 'x' ? [b, a] : [a, b];
        if (tipo === 'panel') this.caja(0.6, 0.03, 0.6, 'luz', x, ALTO - 0.02, z);
        else {
          this.caja(eje === 'x' ? 1.25 : 0.16, 0.08, eje === 'x' ? 0.16 : 1.25, 'acero', x, ALTO - 0.06, z);
          this.caja(eje === 'x' ? 1.2 : 0.1, 0.03, eje === 'x' ? 0.1 : 1.2, 'luz', x, ALTO - 0.11, z);
        }
      }
    }
  }

  /** Tuberías y canaletas a la vista (pisos 1 y 0). */
  tuberias(ax, az, bx, bz, y = ALTO - 0.12, n = 2) {
    if (this.soloDatos) return;
    const L = Math.hypot(bx - ax, bz - az);
    for (let i = 0; i < n; i++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, L, 6), mat('tubo'));
      c.position.set((ax + bx) / 2 + (bz !== az ? i * 0.09 : 0), y - (i % 2) * 0.04, (az + bz) / 2 + (bx !== ax ? i * 0.09 : 0));
      c.rotation.z = bz === az ? Math.PI / 2 : 0;
      c.rotation.x = bx === ax ? Math.PI / 2 : 0;
      this.escena.add(c);
    }
  }

  /* ---------- letreros */
  letrero(texto, x, y, z, rot = 0, estilo = 'ucc', icono = null) {
    if (this.soloDatos) return;
    const { textura, ancho, alto } = texturaLetrero(texto, estilo, icono);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), new THREE.MeshBasicMaterial({ map: textura, transparent: true, toneMapped: false }));
    m.position.set(x, y, z);
    m.rotation.y = rot;
    this.escena.add(m);
    const atras = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), mat('marco'));
    atras.position.copy(m.position);
    atras.rotation.y = rot + Math.PI;
    atras.translateZ(0.005);
    this.escena.add(atras);
    return m;
  }

  /** Imagen plana (mural, afiche, decoración del piso). */
  imagen(textura, ancho, alto, x, y, z, rot = 0, piso = false) {
    if (this.soloDatos) return;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), new THREE.MeshStandardMaterial({ map: textura, transparent: true, roughness: 0.8 }));
    m.position.set(x, y, z);
    if (piso) m.rotation.x = -Math.PI / 2;
    else m.rotation.y = rot;
    this.escena.add(m);
  }
}

function distanciaSegmento(px, pz, s) {
  const dx = s.bx - s.ax, dz = s.bz - s.az;
  const l2 = dx * dx + dz * dz || 1e-9;
  const t = THREE.MathUtils.clamp(((px - s.ax) * dx + (pz - s.az) * dz) / l2, 0, 1);
  return Math.hypot(px - (s.ax + t * dx), pz - (s.az + t * dz));
}

function restarHuecos(r, huecos) {
  let partes = [r];
  for (const h of huecos) {
    const nuevas = [];
    for (const p of partes) {
      if (h.x1 <= p.x0 || h.x0 >= p.x1 || h.z1 <= p.z0 || h.z0 >= p.z1) { nuevas.push(p); continue; }
      if (h.z0 > p.z0) nuevas.push({ x0: p.x0, x1: p.x1, z0: p.z0, z1: h.z0 });
      if (h.z1 < p.z1) nuevas.push({ x0: p.x0, x1: p.x1, z0: h.z1, z1: p.z1 });
      const z0 = Math.max(p.z0, h.z0), z1 = Math.min(p.z1, h.z1);
      if (h.x0 > p.x0) nuevas.push({ x0: p.x0, x1: h.x0, z0, z1 });
      if (h.x1 < p.x1) nuevas.push({ x0: h.x1, x1: p.x1, z0, z1 });
    }
    partes = nuevas;
  }
  return partes;
}

/** Ajusta las UV de una caja para que la textura se repita por metro (ladrillo, baldosa…). */
function uvMundo(geo, w, h, d, esc = 1) {
  const uv = geo.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    uv.setXY(i, uv.getX(i) * dims[f][0] / esc, uv.getY(i) * dims[f][1] / esc);
  }
  uv.needsUpdate = true;
  return geo;
}

/* ======================================================================== Materiales */
const cacheMat = new Map();
export function mat(nombre) {
  if (cacheMat.has(nombre)) return cacheMat.get(nombre);
  const base = {
    techo: { color: '#f5f5f3', roughness: 1, emissive: '#d9dad8', emissiveIntensity: 0.55 },
    acero: { color: '#b9c0c6', metalness: 0.7, roughness: 0.3 },
    marco: { color: '#24272a', metalness: 0.3, roughness: 0.6 },
    vidrio: { color: '#bcd6e2', transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.2, depthWrite: false },
    esmerilado: { color: '#eef3f5', transparent: true, opacity: 0.82, roughness: 0.4 },
    mampara: { color: '#e4efeb', transparent: true, opacity: 0.42, roughness: 0.3, depthWrite: false },
    luz: { color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1.2 },
    tubo: { color: '#c7cbcf', metalness: 0.5, roughness: 0.5 },
    peldano: { map: texturaTerrazo('#cfcac2'), roughness: 0.7 },
    puertaRoja: { color: '#7a2a1d', roughness: 0.6 },
    puertaBlanca: { color: '#f1f1ee', roughness: 0.6 },
    madera: { color: '#b88a5a', roughness: 0.8 },
    maderaOscura: { color: '#6b4426', roughness: 0.8 },
    blanco: { color: '#f2f2ef', roughness: 0.8 },
    negro: { color: '#202326', roughness: 0.6 },
  }[nombre];
  const m = new THREE.MeshStandardMaterial(base ?? { color: nombre, roughness: 0.7 });
  m.userData.compartido = true;
  cacheMat.set(nombre, m);
  return m;
}

function materialMuro(tipo) {
  const clave = 'muro:' + tipo;
  if (cacheMat.has(clave)) return cacheMat.get(clave);
  const m = tipo === 'ladrillo' ? new THREE.MeshStandardMaterial({ map: texturaLadrillo(), roughness: 0.9 })
    : tipo === 'madera' ? new THREE.MeshStandardMaterial({ color: '#7a3f26', roughness: 0.7 })
    : tipo === 'crema' ? new THREE.MeshStandardMaterial({ color: '#efe6d6', roughness: 0.9 })
    : new THREE.MeshStandardMaterial({ color: '#f2f1ed', roughness: 0.9 });
  m.userData.compartido = true;
  cacheMat.set(clave, m);
  return m;
}

function materialPiso(tipo, w, d) {
  // cada piso necesita su propia repetición de textura
  const tex = tipo === 'baldosa' ? texturaBaldosa() : tipo === 'beige' ? texturaTerrazo('#d9c8a6', 128) : texturaTerrazo('#d6d5d0', 256);
  const esc = tipo === 'baldosa' ? 1.2 : 2;
  tex.repeat.set(w / esc, d / esc);
  return new THREE.MeshStandardMaterial({ map: tex, roughness: tipo === 'baldosa' ? 0.18 : 0.45, metalness: 0.05 });
}

/* ======================================================================== Texturas */
function lienzo(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return [cv, cv.getContext('2d')];
}
function textura(cv, repetir = true) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repetir) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

let cvLadrillo;
function texturaLadrillo() {
  if (!cvLadrillo) {
    const [cv, g] = lienzo(256, 256);   // 1 m x 1 m
    g.fillStyle = '#d6cfc4'; g.fillRect(0, 0, 256, 256);
    const filas = 14, alto = 256 / filas, largo = 64;
    let semilla = 3;
    const azar = () => ((semilla = (semilla * 9301 + 49297) % 233280) / 233280);
    for (let f = 0; f < filas; f++) {
      const off = f % 2 ? largo / 2 : 0;
      for (let x = -largo; x < 256 + largo; x += largo) {
        const tono = 150 + azar() * 40;
        g.fillStyle = `rgb(${tono + 35},${tono * 0.48},${tono * 0.3})`;
        g.fillRect(x + off + 1.5, f * alto + 1.5, largo - 3, alto - 3);
      }
    }
    cvLadrillo = cv;
  }
  return textura(cvLadrillo);
}

function texturaTerrazo(base, lado = 256) {
  const [cv, g] = lienzo(512, 512);
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  let semilla = 7;
  const azar = () => ((semilla = (semilla * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 9000; i++) {
    const v = azar();
    g.fillStyle = v < 0.45 ? 'rgba(70,70,70,0.55)' : v < 0.8 ? 'rgba(255,255,255,0.8)' : 'rgba(140,120,100,0.5)';
    const s = 1 + azar() * 2.5;
    g.fillRect(azar() * 512, azar() * 512, s, s);
  }
  g.strokeStyle = 'rgba(120,120,120,0.35)'; g.lineWidth = 1.5;
  for (let p = 0; p <= 512; p += lado) {
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 512); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(512, p); g.stroke();
  }
  return textura(cv);
}

function texturaBaldosa() {
  const [cv, g] = lienzo(256, 256);   // 1.2 m: baldosas de 60 cm
  g.fillStyle = '#f4f5f6'; g.fillRect(0, 0, 256, 256);
  const gr = g.createLinearGradient(0, 0, 256, 256);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(210,214,218,0.35)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#d3d8dc'; g.lineWidth = 2;
  for (const p of [0, 128, 256]) {
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 256); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(256, p); g.stroke();
  }
  return textura(cv);
}

/** Letreros como los del campus: 'ucc' (turquesa con franja negra), 'colgate' (blanco con ícono rojo),
 *  'banos' (azul), 'salida' (verde), 'piso' (turquesa pequeño), 'ami', 'aviso' (genérico). */
function texturaLetrero(texto, estilo, icono) {
  const lineas = Array.isArray(texto) ? texto : [texto];
  const conf = {
    ucc: [512, 300, 0.75], piso: [512, 220, 0.6], colgate: [640, 210, 1.25], banos: [512, 120, 0.85],
    salida: [300, 110, 0.42], ami: [300, 480, 0.55], aviso: [512, 200, 0.9], 'aviso-azul': [512, 150, 0.7],
    'aviso-oscuro': [512, 150, 0.8],
  }[estilo] ?? [512, 200, 0.9];
  const [W, H, ancho] = conf;
  const [cv, g] = lienzo(W, H);
  const redondeado = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };
  const centrar = (ls, y0, tam, color, peso = '600') => {
    g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
    ls.forEach((l, i) => {
      const t = i === ls.length - 1 && ls.length > 1 && l === l.toLowerCase() ? tam * 0.75 : tam;
      g.font = `${peso} ${t}px "Plus Jakarta Sans", sans-serif`;
      g.fillText(l, W / 2, y0 + i * tam * 1.2);
    });
  };
  if (estilo === 'ucc' || estilo === 'piso') {
    g.fillStyle = '#2aa0b3'; redondeado(0, 0, W, H, 26);
    g.fillStyle = '#121416'; g.fillRect(0, H * 0.72, W, H * 0.28);
    g.fillStyle = '#2aa0b3'; g.fillRect(0, H * 0.72, W, 4);
    g.strokeStyle = '#c4d93c'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(W / 2 - 16, H * 0.9); g.lineTo(W / 2, H * 0.8); g.lineTo(W / 2 + 16, H * 0.9); g.stroke();
    const tam = estilo === 'piso' ? 40 : lineas.length > 2 ? 36 : 44;
    centrar(lineas, H * 0.36 - (lineas.length - 1) * tam * 0.6, tam, '#f4fbfc', '500');
  } else if (estilo === 'colgate') {
    g.fillStyle = '#ffffff'; redondeado(0, 0, W, H, 18);
    g.fillStyle = '#e1251b'; redondeado(18, 22, 160, 160, 18);
    dibujarIcono(g, icono, 98, 102);
    g.fillStyle = '#2b2b2b'; g.textAlign = 'left'; g.textBaseline = 'middle';
    lineas.forEach((l, i) => { g.font = `${i === 0 ? 600 : 500} ${i === 0 ? 46 : 38}px "Plus Jakarta Sans", sans-serif`; g.fillText(l, 205, 70 + i * 52); });
    g.fillStyle = '#e1251b'; g.fillRect(205, H - 22, W - 230, 4);
    g.font = 'italic bold 20px sans-serif'; g.textAlign = 'right'; g.fillText('Colgate', W - 24, H - 34);
  } else if (estilo === 'banos') {
    g.fillStyle = '#1c86b8'; redondeado(0, 0, W, H, 14);
    g.fillStyle = '#ffffff'; redondeado(14, 14, 92, 92, 8);
    g.fillStyle = '#1c86b8'; g.beginPath(); g.arc(60, 38, 9, 0, 7); g.fill(); g.fillRect(52, 50, 16, 40);
    centrar(lineas, H / 2, 54, '#ffffff', '700');
  } else if (estilo === 'salida') {
    g.fillStyle = '#1e9440'; g.fillRect(0, 0, W, H);
    centrar(lineas, H / 2, 58, '#eaffef', '700');
  } else if (estilo === 'ami') {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1f8fa8'; g.font = 'italic 700 74px serif'; g.textAlign = 'center'; g.fillText('Ami', W / 2, 120);
    g.fillStyle = '#1f8fa8'; g.fillRect(0, 170, W, H - 170);
    g.fillStyle = '#ffffff'; g.font = '600 30px sans-serif'; g.textAlign = 'left';
    lineas.forEach((l, i) => g.fillText(l, 26, 215 + i * 54));
  } else {
    const fondo = estilo === 'aviso-azul' ? '#2c6db5' : estilo === 'aviso-oscuro' ? '#2f3a44' : '#ffffff';
    g.fillStyle = fondo; redondeado(0, 0, W, H, 10);
    centrar(lineas, H / 2 - (lineas.length - 1) * 22, lineas.length > 2 ? 30 : 38, fondo === '#ffffff' ? '#24313c' : '#ffffff', '700');
  }
  return { textura: textura(cv, false), ancho, alto: ancho * H / W };
}

function dibujarIcono(g, icono, cx, cy) {
  g.strokeStyle = '#ffffff'; g.fillStyle = '#ffffff'; g.lineWidth = 10; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath();
  if (icono === 'escalera') {
    g.moveTo(cx - 50, cy + 40); g.lineTo(cx - 25, cy + 40); g.lineTo(cx - 25, cy + 15); g.lineTo(cx, cy + 15);
    g.lineTo(cx, cy - 10); g.lineTo(cx + 25, cy - 10); g.lineTo(cx + 25, cy - 35); g.lineTo(cx + 50, cy - 35); g.stroke();
  } else if (icono === 'archivo') {
    g.lineWidth = 6; g.strokeRect(cx - 50, cy - 40, 100, 80);
    for (let i = 0; i < 4; i++) g.fillRect(cx - 40 + i * 22, cy - 28, 12, 56);
  } else {   // sillón odontológico
    g.moveTo(cx - 45, cy - 30); g.lineTo(cx - 20, cy + 10); g.lineTo(cx + 40, cy + 10); g.stroke();
    g.beginPath(); g.moveTo(cx - 5, cy + 10); g.lineTo(cx - 5, cy + 40); g.stroke();
    g.beginPath(); g.arc(cx - 45, cy - 38, 9, 0, 7); g.fill();
  }
}

export { texturaTerrazo, lienzo, textura };
