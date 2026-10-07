import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

const ALTURA_PISO = 3.6;

/** Escena 3D del campus: dibuja los bloques que llegan del backend y permite seleccionarlos. */
export class Campus3D {
  constructor(contenedor, { alSeleccionar } = {}) {
    this.contenedor = contenedor;
    this.alSeleccionar = alSeleccionar;
    this.bloques = new Map(); // id -> { malla, etiqueta, datos }
    this.seleccionado = null;
    this.animacion = null;

    this.#crearEscena();
    this.#crearEntorno();
    this.#eventos();
    this.renderer.setAnimationLoop(() => this.#cuadro());
  }

  #crearEscena() {
    const { clientWidth: w, clientHeight: h } = this.contenedor;

    this.escena = new THREE.Scene();
    this.escena.background = new THREE.Color('#dfe9f3');
    this.escena.fog = new THREE.Fog('#dfe9f3', 140, 260);

    this.camara = new THREE.PerspectiveCamera(45, w / h, 0.5, 600);
    this.camara.position.set(70, 75, 95);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.contenedor.appendChild(this.renderer.domElement);

    this.etiquetas = new CSS2DRenderer();
    this.etiquetas.setSize(w, h);
    Object.assign(this.etiquetas.domElement.style, { position: 'absolute', top: '0', pointerEvents: 'none' });
    this.contenedor.appendChild(this.etiquetas.domElement);

    this.controles = new OrbitControls(this.camara, this.renderer.domElement);
    this.controles.enableDamping = true;
    this.controles.maxPolarAngle = Math.PI * 0.46;
    this.controles.minDistance = 25;
    this.controles.maxDistance = 220;
    this.controles.target.set(0, 0, 0);

    this.escena.add(new THREE.HemisphereLight('#ffffff', '#9fb5a0', 1.4));
    const sol = new THREE.DirectionalLight('#ffffff', 1.6);
    sol.position.set(60, 100, 40);
    sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    Object.assign(sol.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, far: 300 });
    this.escena.add(sol);
  }

  #crearEntorno() {
    // Terreno del campus
    const suelo = new THREE.Mesh(
      new THREE.CircleGeometry(150, 64),
      new THREE.MeshStandardMaterial({ color: '#b8d4a8' })
    );
    suelo.rotation.x = -Math.PI / 2;
    suelo.receiveShadow = true;
    this.escena.add(suelo);

    // Senderos peatonales
    const materialCamino = new THREE.MeshStandardMaterial({ color: '#e9e4d8' });
    const caminos = [
      [0, 15, 6, 70],   // eje central norte-sur
      [0, 12, 80, 5],   // eje oriente-occidente
      [0, -16, 70, 4],
      [44, 30, 5, 30],
    ];
    for (const [x, z, w, d] of caminos) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(w, d), materialCamino);
      c.rotation.x = -Math.PI / 2;
      c.position.set(x, 0.02, z);
      c.receiveShadow = true;
      this.escena.add(c);
    }
  }

  /** Dibuja los bloques del campus (datos del backend). */
  cargar(edificios) {
    for (const e of edificios) {
      const plano = e.pisos === 0;
      const alto = plano ? 0.4 : e.pisos * ALTURA_PISO;
      const color = new THREE.Color(e.color);

      const malla = new THREE.Mesh(
        new THREE.BoxGeometry(e.ancho, alto, e.profundidad),
        new THREE.MeshStandardMaterial({ color, roughness: 0.75 })
      );
      malla.position.set(e.x, alto / 2, e.z);
      malla.castShadow = !plano;
      malla.receiveShadow = true;
      malla.userData.id = e.id;

      // Líneas de pisos para que se lean como edificios
      if (!plano) {
        malla.add(new THREE.LineSegments(
          new THREE.EdgesGeometry(malla.geometry),
          new THREE.LineBasicMaterial({ color: color.clone().multiplyScalar(0.6) })
        ));
        for (let p = 1; p < e.pisos; p++) {
          const franja = new THREE.Mesh(
            new THREE.BoxGeometry(e.ancho + 0.15, 0.25, e.profundidad + 0.15),
            new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.5 })
          );
          franja.position.y = -alto / 2 + p * ALTURA_PISO;
          malla.add(franja);
        }
      }

      const div = document.createElement('div');
      div.className = 'etiqueta-3d';
      div.textContent = e.nombre.split(' - ')[0];
      const etiqueta = new CSS2DObject(div);
      etiqueta.position.set(0, alto / 2 + 2.5, 0);
      malla.add(etiqueta);

      this.escena.add(malla);
      this.bloques.set(e.id, { malla, etiqueta: div, datos: e });
    }
    this.#sembrarArboles(edificios);
  }

  #sembrarArboles(edificios) {
    const ocupado = (x, z) =>
      edificios.some(e => Math.abs(x - e.x) < e.ancho / 2 + 3 && Math.abs(z - e.z) < e.profundidad / 2 + 3)
      || Math.abs(x) < 5 || Math.abs(z - 12) < 4;
    const tronco = new THREE.MeshStandardMaterial({ color: '#7a5a3a' });
    const copa = new THREE.MeshStandardMaterial({ color: '#4f8a4b' });
    let semilla = 7;
    const azar = () => ((semilla = (semilla * 9301 + 49297) % 233280) / 233280);
    for (let i = 0, colocados = 0; i < 400 && colocados < 70; i++) {
      const x = (azar() - 0.5) * 150, z = (azar() - 0.5) * 130;
      if (ocupado(x, z) || Math.hypot(x, z) > 85) continue;
      const arbol = new THREE.Group();
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 2), tronco);
      t.position.y = 1;
      const c = new THREE.Mesh(new THREE.ConeGeometry(1.6 + azar(), 4 + azar() * 2, 7), copa);
      c.position.y = 4;
      c.castShadow = true;
      arbol.add(t, c);
      arbol.position.set(x, 0, z);
      this.escena.add(arbol);
      colocados++;
    }
  }

  /** Resalta un bloque y mueve la cámara hacia él. */
  seleccionar(id) {
    if (this.seleccionado) {
      const prev = this.bloques.get(this.seleccionado);
      prev.malla.material.emissive.set('#000000');
      prev.etiqueta.classList.remove('activa');
    }
    this.seleccionado = id;
    const b = this.bloques.get(id);
    if (!b) return;
    b.malla.material.emissive.set('#2a4a7a');
    b.etiqueta.classList.add('activa');

    const destino = new THREE.Vector3(b.datos.x, 0, b.datos.z);
    const offset = new THREE.Vector3(40, 70, 85);
    this.animacion = {
      t: 0,
      desdeObjetivo: this.controles.target.clone(),
      haciaObjetivo: destino,
      desdeCamara: this.camara.position.clone(),
      haciaCamara: destino.clone().add(offset),
    };
  }

  deseleccionar() {
    if (!this.seleccionado) return;
    const b = this.bloques.get(this.seleccionado);
    b.malla.material.emissive.set('#000000');
    b.etiqueta.classList.remove('activa');
    this.seleccionado = null;
  }

  #eventos() {
    const raycaster = new THREE.Raycaster();
    const puntero = new THREE.Vector2();
    let inicio = null;

    const tocar = (ev) => {
      const r = this.renderer.domElement.getBoundingClientRect();
      puntero.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(puntero, this.camara);
      const mallas = [...this.bloques.values()].map(b => b.malla);
      const hit = raycaster.intersectObjects(mallas, false)[0];
      return hit ? hit.object.userData.id : null;
    };

    const lienzo = this.renderer.domElement;
    lienzo.addEventListener('pointerdown', ev => (inicio = { x: ev.clientX, y: ev.clientY }));
    lienzo.addEventListener('pointerup', ev => {
      // Solo cuenta como clic si no se arrastró la cámara
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
      a.t = Math.min(1, a.t + 0.025);
      const k = 1 - Math.pow(1 - a.t, 3); // suavizado
      this.controles.target.lerpVectors(a.desdeObjetivo, a.haciaObjetivo, k);
      this.camara.position.lerpVectors(a.desdeCamara, a.haciaCamara, k);
      if (a.t === 1) this.animacion = null;
    }
    this.controles.update();
    this.renderer.render(this.escena, this.camara);
    this.etiquetas.render(this.escena, this.camara);
  }
}
