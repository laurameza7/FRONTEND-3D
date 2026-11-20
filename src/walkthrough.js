import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { INTERIORS } from './floorPlans.js';

/*
 * First-person walkthrough of the interior of the blocks.
 * Each floor is built from a "plan" (floorPlans.js) with the construction Kit below:
 * walls, glass walls, stairs, furniture and signs. The engine handles the camera,
 * collisions, going up/down stairs, changing floors, the minimap and the "Ir a" menu.
 */

export const HEIGHT = 3;          // clear height of each floor (m)
const EYE_HEIGHT = 1.6;               // eye height
const RADIUS = 0.3;              // visitor radius for collisions
const SPEED = 2.4;          // m/s walking
const TURN_SPEED = 1.9;               // rad/s with the arrow keys

export const hasInterior = (code) => Boolean(INTERIORS[code]);

/** Finds the interior destination that matches a place of the database. */
export function destinationOfPlace(buildingCode, placeName) {
  const building = INTERIORS[buildingCode];
  if (!building) return null;
  const n = normalize(placeName);
  for (const level of building.levels)
    for (const d of level.destinations ?? [])
      if ((d.places ?? []).some(l => normalize(l) === n)) return { level: level.id, destination: d.id };
  return null;
}

/** Finds, in free text (Coopi's answer), the first place with an interior that is mentioned. */
export function destinationInText(buildingCode, text) {
  const building = INTERIORS[buildingCode];
  if (!building) return null;
  const t = normalize(text);
  let best = null;
  for (const level of building.levels)
    for (const d of level.destinations ?? [])
      for (const l of [...(d.places ?? []), ...(d.keys ?? [])]) {
        const pos = t.indexOf(normalize(l));
        if (pos >= 0 && (!best || pos < best.pos)) best = { pos, level: level.id, destination: d.id, name: d.name };
      }
  return best;
}

function normalize(s) {
  return String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

/* ======================================================================== Engine */
export class Walkthrough {
  constructor({ onExit } = {}) {
    this.onExit = onExit;
    this.dom = {
      root: document.getElementById('walkthrough'),
      scene: document.getElementById('walkthrough-scene'),
      building: document.getElementById('rec-building'),
      level: document.getElementById('rec-level'),
      levels: document.getElementById('rec-levels'),
      destinations: document.getElementById('rec-destinations'),
      floorPlan: document.getElementById('rec-map'),
      fade: document.getElementById('rec-fade'),
      place: document.getElementById('rec-place'),
    };
    this.keys = new Set();
    this.yaw = 0; this.pitch = 0;
    this.pos = new THREE.Vector2();
    this.goal = null;
    this.started = false;
  }

  /* ---------------------------------------------------------------- open / close */
  openAt(code, levelId, destinationId) {
    const building = INTERIORS[code];
    if (!building) return;
    if (!this.started) this.#begin();
    this.dom.root.hidden = false;
    this.#resize();
    this.#changeBuilding(code, levelId ?? building.start ?? building.levels[0].id, destinationId);
    this.clock.start();
    this.renderer.setAnimationLoop(() => this.#picture());
  }

  /** Changes block (for example, when crossing the passage from Block B to Block A). */
  #changeBuilding(code, levelId, destinationId) {
    const building = INTERIORS[code];
    this.building = building;
    this.code = code;
    this.dom.building.textContent = building.name;
    this.dom.levels.innerHTML = [...building.levels].sort((a, b) => b.id - a.id)
      .map(n => `<button type="button" data-level="${n.id}">${n.short}</button>`).join('');
    this.#loadLevel(levelId, destinationId);
  }

  close() {
    this.dom.root.hidden = true;
    this.renderer?.setAnimationLoop(null);
    this.keys.clear();
    this.onExit?.();
  }

  get open() { return !this.dom.root.hidden; }

  /** Goes to a destination (with a fade), changing floors if needed. */
  goTo(levelId, destinationId) {
    this.#fade(() => {
      if (levelId !== this.level.id) this.#loadLevel(levelId, destinationId);
      else this.#locate(this.kit.destinations.find(d => d.id === destinationId));
    });
  }

  /* ---------------------------------------------------------------- initialization */
  #begin() {
    this.started = true;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    // Environment map: soft reflections on shiny floors, glass and metal
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.dom.scene.appendChild(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    Object.assign(this.labels.domElement.style, { position: 'absolute', top: '0', pointerEvents: 'none' });
    this.dom.scene.appendChild(this.labels.domElement);

    this.camera = new THREE.PerspectiveCamera(72, 1, 0.05, 120);
    this.camera.rotation.order = 'YXZ';
    this.clock = new THREE.Clock(false);
    this.raycaster = new THREE.Raycaster();

    window.addEventListener('resize', () => this.open && this.#resize());

    // Look by dragging · click on the floor to walk to that point
    const canvas = this.renderer.domElement;
    let ini = null, last = null;
    canvas.addEventListener('pointerdown', ev => {
      ini = last = { x: ev.clientX, y: ev.clientY };
      canvas.setPointerCapture(ev.pointerId);
    });
    canvas.addEventListener('pointermove', ev => {
      if (!last) return;
      this.yaw += (ev.clientX - last.x) * 0.004;
      this.pitch = THREE.MathUtils.clamp(this.pitch + (ev.clientY - last.y) * 0.003, -1.1, 1.1);
      last = { x: ev.clientX, y: ev.clientY };
    });
    canvas.addEventListener('pointerup', ev => {
      const click = ini && Math.hypot(ev.clientX - ini.x, ev.clientY - ini.y) < 6;
      ini = last = null;
      if (click) this.#clickOnScene(ev);
    });

    // Keyboard
    window.addEventListener('keydown', ev => {
      if (!this.open || ev.target.closest?.('input, textarea, select')) return;
      const k = ev.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
        this.keys.add(k); this.goal = null; ev.preventDefault();
      }
      if (k === 'escape') this.close();
    });
    window.addEventListener('keyup', ev => this.keys.delete(ev.key.toLowerCase()));

    // On-screen controls (phone)
    document.querySelectorAll('[data-key]').forEach(b => {
      const k = b.dataset.key;
      b.addEventListener('pointerdown', e => { e.preventDefault(); this.keys.add(k); this.goal = null; });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => b.addEventListener(t, () => this.keys.delete(k)));
    });

    this.dom.levels.addEventListener('click', ev => {
      const b = ev.target.closest('[data-level]');
      if (!b) return;
      const id = Number(b.dataset.level);
      if (id !== this.level.id) this.#fade(() => this.#loadLevel(id));
      b.blur();
    });
    this.dom.destinations.addEventListener('change', () => {
      const [level, destination] = this.dom.destinations.value.split('|');
      if (destination) this.goTo(Number(level), destination);
      this.dom.destinations.value = '';
      this.dom.destinations.blur();   // gives the keyboard back to the walkthrough
    });
    this.dom.floorPlan.addEventListener('click', ev => this.#clickOnMap(ev));
    document.getElementById('rec-exit').addEventListener('click', () => this.close());
  }

  #resize() {
    const w = this.dom.scene.clientWidth || window.innerWidth;
    const h = this.dom.scene.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h);
    this.labels.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /* ---------------------------------------------------------------- floors */
  #loadLevel(levelId, destinationId) {
    const level = this.building.levels.find(n => n.id === levelId) ?? this.building.levels[0];
    if (this.scene) dispose(this.scene);
    this.scene = new THREE.Scene();
    // Light sky behind the windows (daytime, as in the videos)
    this.scene.background = new THREE.Color(level.sky ?? '#dbe6ee');
    this.scene.environment = this.environment;
    this.scene.environmentIntensity = 0.45;
    this.scene.add(new THREE.HemisphereLight('#fffaf0', '#7d776f', 1.05));
    this.scene.add(new THREE.AmbientLight('#ffffff', 0.18));
    const light = new THREE.DirectionalLight('#fff3e0', 0.85);
    light.position.set(4, 10, 6);
    this.scene.add(light);

    this.kit = new Kit(this.scene, level.style ?? {});
    this.kit.destinations = level.destinations ?? [];
    level.build(this.kit);
    this.kit.finalize();
    this.level = level;

    this.dom.level.textContent = level.name;
    this.dom.levels.querySelectorAll('button').forEach(b => b.classList.toggle('active', Number(b.dataset.level) === level.id));
    this.#fillDestinations();
    this.#prepareMap();
    const d = this.kit.destinations.find(x => x.id === destinationId) ?? this.kit.destinations[0];
    this.#locate(d);
  }

  #fillDestinations() {
    this.dom.destinations.innerHTML = '<option value="">Ir a…</option>' + this.building.levels.map(n =>
      `<optgroup label="${n.name}">${n.destinations.filter(d => !d.hidden).map(d =>
        `<option value="${n.id}|${d.id}">${d.name}${d.approximate ? ' *' : ''}</option>`).join('')}</optgroup>`).join('');
  }

  #locate(d) {
    if (!d) return;
    this.pos.set(d.x, d.z);
    this.yaw = d.yaw ?? 0;
    this.pitch = -0.05;
    this.goal = null;
    this.#showPlace(d);
  }

  #showPlace(d) {
    this.currentPlace = d.id;
    this.dom.place.innerHTML = `<strong>${d.name}</strong>${d.note ? `<span>${d.note}</span>` : ''}` +
      (d.approximate ? '<span class="approx">* Interior aproximado: aún no hay fotos de este espacio.</span>' : '');
    this.dom.place.hidden = false;
  }

  #fade(action) {
    const f = this.dom.fade;
    f.classList.add('active');
    setTimeout(() => { action(); setTimeout(() => f.classList.remove('active'), 60); }, 260);
  }

  /* ---------------------------------------------------------------- movement and collisions */
  #picture() {
    const dt = Math.min(this.clock.getDelta(), 0.12);
    const t = this.keys;
    if (t.has('arrowleft')) this.yaw += TURN_SPEED * dt;
    if (t.has('arrowright')) this.yaw -= TURN_SPEED * dt;

    const forward = new THREE.Vector2(-Math.sin(this.yaw), -Math.cos(this.yaw));
    const rightSide = new THREE.Vector2(-forward.y, forward.x);
    const mov = new THREE.Vector2();
    if (t.has('w') || t.has('arrowup')) mov.add(forward);
    if (t.has('s') || t.has('arrowdown')) mov.sub(forward);
    if (t.has('d')) mov.add(rightSide);
    if (t.has('a')) mov.sub(rightSide);

    if (this.goal) {
      const missing = this.goal.clone().sub(this.pos);
      if (missing.length() < 0.15) this.goal = null;
      else {
        mov.copy(missing.normalize());
        // turns smoothly towards where it walks
        const yawGoal = Math.atan2(-mov.x, -mov.y);
        let diff = yawGoal - this.yaw;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.yaw += diff * Math.min(1, dt * 4);
      }
    }
    if (mov.lengthSq() > 0) {
      mov.normalize().multiplyScalar(SPEED * dt);
      const before = this.pos.clone();
      // sliding along the axes so it does not get stuck on walls
      if (this.kit.isFree(this.pos.x + mov.x, this.pos.y)) this.pos.x += mov.x;
      if (this.kit.isFree(this.pos.x, this.pos.y + mov.y)) this.pos.y += mov.y;
      if (this.goal && before.distanceTo(this.pos) < 1e-4) this.goal = null;
      this.#checkPortals();
      this.#checkPlace();
    }

    const heightAt = this.kit.heightAtPoint(this.pos.x, this.pos.y);
    this.camera.position.set(this.pos.x, EYE_HEIGHT + heightAt, this.pos.y);
    this.camera.rotation.set(this.pitch, this.yaw, 0);
    this.#hideCoveredLabels();
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
    this.#drawMap();
  }

  /** HTML labels are not hidden by walls on their own: they are hidden if a wall is between the camera and them. */
  #hideCoveredLabels() {
    this.frames = (this.frames ?? 0) + 1;
    if (this.frames % 8) return;
    const eye = this.camera.position;
    for (const r of this.kit.tags) {
      const dir = r.position.clone().sub(eye);
      const dist = dir.length();
      let visible = dist < 16;
      if (visible) {
        this.raycaster.set(eye, dir.normalize());
        this.raycaster.far = dist - 0.3;
        visible = this.raycaster.intersectObjects(this.kit.opaque, false).length === 0;
      }
      r.visible = visible;
    }
    this.raycaster.far = Infinity;
  }

  #checkPortals() {
    const p = this.kit.portals.find(p => this.pos.x > p.x0 && this.pos.x < p.x1 && this.pos.y > p.z0 && this.pos.y < p.z1);
    if (p && !this.changing) {
      this.changing = true;
      this.keys.clear();
      this.goal = null;
      this.#fade(() => {
        if (p.building && p.building !== this.code) this.#changeBuilding(p.building, p.level, p.arrival);
        else this.#loadLevel(p.level, p.arrival);
        this.changing = false;
      });
    }
  }

  /** Shows the name of the space you are in (zones defined in the plan). */
  #checkPlace() {
    const z = this.kit.zones.find(z => this.pos.x > z.x0 && this.pos.x < z.x1 && this.pos.y > z.z0 && this.pos.y < z.z1);
    if (z && z.destination !== this.currentPlace) {
      const d = this.kit.destinations.find(d => d.id === z.destination);
      if (d) this.#showPlace(d);
    }
  }

  #clickOnScene(ev) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const p = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(p, this.camera);
    const hit = this.raycaster.intersectObjects(this.kit.walkables, false)[0];
    if (hit && hit.distance < 25) this.goal = new THREE.Vector2(hit.point.x, hit.point.z);
  }

  /* ---------------------------------------------------------------- minimap */
  #prepareMap() {
    const cv = this.dom.floorPlan, g = cv.getContext('2d');
    const { x0, z0, x1, z1 } = this.kit.bounds;
    const m = 10;
    this.mapScale = Math.min((cv.width - 2 * m) / (x1 - x0), (cv.height - 2 * m) / (z1 - z0));
    this.mapOrigin = { x: m + ((cv.width - 2 * m) - (x1 - x0) * this.mapScale) / 2 - x0 * this.mapScale,
                         y: m + ((cv.height - 2 * m) - (z1 - z0) * this.mapScale) / 2 - z0 * this.mapScale };
    const base = document.createElement('canvas');
    base.width = cv.width; base.height = cv.height;
    const b = base.getContext('2d');
    const P = (x, z) => [this.mapOrigin.x + x * this.mapScale, this.mapOrigin.y + z * this.mapScale];
    b.fillStyle = '#f7f8fa'; b.fillRect(0, 0, cv.width, cv.height);
    b.fillStyle = '#e3e7ec';
    for (const r of this.kit.floorRects) { const [a, c] = P(r.x0, r.z0); b.fillRect(a, c, (r.x1 - r.x0) * this.mapScale, (r.z1 - r.z0) * this.mapScale); }
    b.fillStyle = '#f6d9a8';
    for (const r of this.kit.ramps) { const [a, c] = P(r.x0, r.z0); b.fillRect(a, c, (r.x1 - r.x0) * this.mapScale, (r.z1 - r.z0) * this.mapScale); }
    b.fillStyle = '#c9ced5';
    for (const o of this.kit.obstacles) { const [a, c] = P(o.x0, o.z0); b.fillRect(a, c, (o.x1 - o.x0) * this.mapScale, (o.z1 - o.z0) * this.mapScale); }
    b.strokeStyle = '#3c4650'; b.lineWidth = 1.6;
    for (const s of this.kit.walls) { b.beginPath(); b.moveTo(...P(s.ax, s.az)); b.lineTo(...P(s.bx, s.bz)); b.stroke(); }
    for (const d of this.kit.destinations.filter(d => !d.hidden)) {
      const [a, c] = P(d.x, d.z);
      b.fillStyle = d.approximate ? '#9aa5b1' : '#1f9bb0';
      b.beginPath(); b.arc(a, c, 3.2, 0, Math.PI * 2); b.fill();
    }
    this.mapBase = base;
  }

  #drawMap() {
    const cv = this.dom.floorPlan, g = cv.getContext('2d');
    g.drawImage(this.mapBase, 0, 0);
    const x = this.mapOrigin.x + this.pos.x * this.mapScale;
    const y = this.mapOrigin.y + this.pos.y * this.mapScale;
    g.save();
    g.translate(x, y);
    g.rotate(-this.yaw);
    g.fillStyle = 'rgba(0,77,153,0.18)';
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 22, -Math.PI / 2 - 0.6, -Math.PI / 2 + 0.6); g.closePath(); g.fill();
    g.fillStyle = '#004d99';
    g.beginPath(); g.moveTo(0, -7); g.lineTo(5, 5); g.lineTo(0, 2.5); g.lineTo(-5, 5); g.closePath(); g.fill();
    g.restore();
  }

  #clickOnMap(ev) {
    const r = this.dom.floorPlan.getBoundingClientRect();
    const px = (ev.clientX - r.left) * this.dom.floorPlan.width / r.width;
    const py = (ev.clientY - r.top) * this.dom.floorPlan.height / r.height;
    const x = (px - this.mapOrigin.x) / this.mapScale;
    const z = (py - this.mapOrigin.y) / this.mapScale;
    // click on a destination? → go there; otherwise to that point if it is free
    const d = this.kit.destinations.find(d => !d.hidden && Math.hypot(d.x - x, d.z - z) < 1.2);
    if (d) return this.goTo(this.level.id, d.id);
    if (this.kit.isFree(x, z)) this.#fade(() => { this.pos.set(x, z); this.goal = null; });
  }
}

function dispose(obj) {
  obj.traverse(o => {
    o.geometry?.dispose();
    const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    ms.forEach(m => { if (!m.userData.shared) m.dispose(); });
    if (o.isCSS2DObject) o.element.remove();
  });
}

/* ======================================================================== Construction kit */
export class Kit {
  constructor(scene, style = {}, dataOnly = false) {
    this.scene = scene;
    this.dataOnly = dataOnly;            // to read destinations without building heavy geometry
    this.style = { floor: 'terrazzo', wall: 'white', lamps: 'tube', ...style };
    this.walls = []; this.obstacles = []; this.floorRects = []; this.openings = [];
    this.ramps = []; this.portals = []; this.destinations = []; this.zones = []; this.walkables = [];
    this.opaque = []; this.tags = [];
    this.bounds = { x0: -10, z0: -10, x1: 10, z1: 10 };
  }

  /* ---------- navigation data */
  setBounds(x0, z0, x1, z1) { this.bounds = { x0, z0, x1, z1 }; }
  destination(id, name, x, z, yaw = 0, extra = {}) { this.destinations.push({ id, name, x, z, yaw, ...extra }); }
  zone(destination, x0, z0, x1, z1) { this.zones.push({ destination, x0, z0, x1, z1 }); }
  portal(x0, z0, x1, z1, level, arrival, building) { this.portals.push({ x0, z0, x1, z1, level, arrival, building }); }
  obstacle(x0, z0, x1, z1) { this.obstacles.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) }); }

  isFree(x, z) {
    const onRamp = this.ramps.some(r => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
    // inclusive edges: right where two floor segments meet you can also walk
    const onFloor = onRamp || (this.floorRects.some(r => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1)
      && !this.openings.some(h => x > h.x0 && x < h.x1 && z > h.z0 && z < h.z1));
    if (!onFloor) return false;
    for (const s of this.walls) if (segmentDistance(x, z, s) < RADIUS) return false;
    for (const o of this.obstacles)
      if (x > o.x0 - RADIUS && x < o.x1 + RADIUS && z > o.z0 - RADIUS && z < o.z1 + RADIUS) return false;
    return true;
  }

  heightAtPoint(x, z) {
    const r = this.ramps.find(r => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
    if (!r) return 0;
    const t = THREE.MathUtils.clamp((z - r.zIni) / (r.zFin - r.zIni), 0, 1);
    return r.h * t;
  }

  /* ---------- geometry utilities */
  add(o) { if (!this.dataOnly) this.scene.add(o); return o; }

  box(w, h, d, material, x, y, z, parent = null, rotY = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof material === 'string' ? mat(material) : material);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    (parent ?? this.scene).add(m);
    return m;
  }

  /** Places a furniture group. If it is solid, its footprint blocks the way. */
  placeObject(g, x, z, rot = 0, solid = true, y = 0) {
    g.position.set(x, y, z);
    g.rotation.y = rot;
    if (this.dataOnly) return g;
    this.scene.add(g);
    g.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(g);
    if (solid) this.obstacle(b.min.x, b.min.z, b.max.x, b.max.z);
    // Soft contact shadow under the furniture (adds weight and realism without real-time shadows)
    if (y < 0.05 && b.max.y < 2.6 && !g.userData.noShadow) {
      const w = b.max.x - b.min.x, d = b.max.z - b.min.z;
      if (w > 0.15 && d > 0.15 && w < 12 && d < 12) {
        const s = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.25 + 0.15, d * 1.25 + 0.15), mat('shadow'));
        s.rotation.x = -Math.PI / 2;
        s.position.set((b.min.x + b.max.x) / 2, 0.006, (b.min.z + b.max.z) / 2);
        this.scene.add(s);
      }
    }
    return g;
  }

  label(text, x, y, z, cssClass = 'label-interior') {
    if (this.dataOnly) return;
    const div = document.createElement('div');
    div.className = cssClass;
    div.textContent = text;
    const o = new CSS2DObject(div);
    o.position.set(x, y, z);
    this.scene.add(o);
    this.tags.push(o);
  }

  /* ---------- floors and ceilings (built at the end, leaving out the stair openings) */
  floor(x0, z0, x1, z1, type) { this.floorRects.push({ x0, z0, x1, z1, type: type ?? this.style.floor }); }

  finalize() {
    if (this.dataOnly) return;
    for (const r of this.floorRects) {
      for (const p of subtractOpenings(r, this.openings)) {
        const w = p.x1 - p.x0, d = p.z1 - p.z0;
        const floor = this.box(w, 0.1, d, floorMaterial(r.type, w, d), (p.x0 + p.x1) / 2, -0.05, (p.z0 + p.z1) / 2);
        this.walkables.push(floor);
      }
      const w = r.x1 - r.x0, d = r.z1 - r.z0;
      if (r.noCeiling) continue;
      this.box(w, 0.1, d, this.style.ceiling === 'grid' ? gridCeilingMaterial(w, d) : 'ceiling', (r.x0 + r.x1) / 2, HEIGHT + 0.05, (r.z0 + r.z1) / 2);
    }
    this.#merge();
  }

  /**
   * Merges everything that does not move (furniture, walls, frames) into one mesh per material:
   * from thousands of objects down to a few dozen, so the walkthrough runs smoothly even on phones.
   */
  #merge() {
    const groups = new Map();
    const reserved = new Set([...this.walkables, ...this.opaque]);
    this.scene.updateMatrixWorld(true);
    this.scene.traverse(o => {
      if (!o.isMesh || reserved.has(o) || o.userData.dynamic || Array.isArray(o.material)) return;
      if (o.material.map && !o.material.userData.shared) return;          // unique textures (signs)
      const password = o.material.uuid;
      if (!groups.has(password)) groups.set(password, []);
      groups.get(password).push(o);
    });
    for (const list of groups.values()) {
      if (list.length < 2) continue;
      const geos = [];
      for (const o of list) {
        let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
        for (const n of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(n)) g.deleteAttribute(n);
        if (!g.attributes.uv) continue;
        g.applyMatrix4(o.matrixWorld);
        geos.push(g);
      }
      const merged = geos.length > 1 ? mergeGeometries(geos, false) : null;
      geos.forEach(g => g.dispose());
      if (!merged) continue;
      for (const o of list) o.parent?.remove(o);
      const m = new THREE.Mesh(merged, list[0].material);
      this.scene.add(m);
    }
  }

  /* ---------- walls */
  /**
   * Straight wall from A to B. Options:
   *  mat: 'white' | 'brick' | 'wood' | 'cream'
   *  openings: [[t0, t1]] segments (in meters from A) without wall, for doors
   *  windows: [[t0, t1]] segments with a window (wall below and above, glass in the middle)
   *  serviceCounter: [[t0, t1]] service windows (low wall + glass + shelf)
   */
  wall(ax, az, bx, bz, op = {}) {
    const { mat: m = this.style.wall, openings = [], windows = [], serviceCounter = [], height = HEIGHT, thickness = 0.16 } = op;
    const L = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / L, uz = (bz - az) / L;
    const ang = Math.atan2(-(bz - az), bx - ax);
    const band = m === 'whiteBand';
    const segment = (t0, t1, y0, y1, material) => {
      if (t1 - t0 < 0.01 || y1 - y0 < 0.01 || this.dataOnly) return;
      const length = t1 - t0, cx = ax + ux * (t0 + length / 2), cz = az + uz * (t0 + length / 2);
      const geo = new THREE.BoxGeometry(length, y1 - y0, thickness);
      worldUV(geo, length, y1 - y0, thickness);
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.set(cx, (y0 + y1) / 2, cz);
      mesh.rotation.y = ang;
      this.scene.add(mesh);
      this.opaque.push(mesh);
      // Dark skirting and, in Block A, the wooden band at half height
      const strips = y0 === 0 ? [[0, 0.1, 'skirting']] : [];
      if (band && y0 < 0.9 && y1 > 1.0) strips.push([0.86, 1.0, 'band']);
      for (const [b0, b1, mb] of strips) {
        const bm = new THREE.Mesh(new THREE.BoxGeometry(length, b1 - b0, thickness + 0.03), mat(mb));
        bm.position.set(cx, (b0 + b1) / 2, cz);
        bm.rotation.y = ang;
        this.scene.add(bm);
      }
    };
    const material = wallMaterial(m);
    const cuts = [...openings.map(h => ({ t0: h[0], t1: h[1], type: 'opening' })),
                    ...windows.map(h => ({ t0: h[0], t1: h[1], type: 'window' })),
                    ...serviceCounter.map(h => ({ t0: h[0], t1: h[1], type: 'serviceCounter' }))].sort((a, b) => a.t0 - b.t0);
    let t = 0;
    const solid = (t0, t1) => this.walls.push({ ax: ax + ux * t0, az: az + uz * t0, bx: ax + ux * t1, bz: az + uz * t1 });
    for (const c of cuts) {
      segment(t, c.t0, 0, height, material);
      if (c.t0 > t) solid(t, c.t0);
      if (c.type === 'opening') {
        segment(c.t0, c.t1, 2.2, height, material);          // lintel
      } else {
        const low = c.type === 'serviceCounter' ? 1.05 : 0.95, height2 = c.type === 'serviceCounter' ? 2.4 : 2.2;
        segment(c.t0, c.t1, 0, low, material);
        segment(c.t0, c.t1, height2, height, material);
        this.#glass(ax + ux * c.t0, az + uz * c.t0, ax + ux * c.t1, az + uz * c.t1, low, height2, false);
        if (c.type === 'serviceCounter' && !this.dataOnly) {
          const length = c.t1 - c.t0, cx = ax + ux * (c.t0 + length / 2), cz = az + uz * (c.t0 + length / 2);
          const shelfBoard = this.box(length, 0.04, 0.45, 'steel', cx, low + 0.02, cz, null, ang);
          shelfBoard.position.x += -uz * 0.2; shelfBoard.position.z += ux * 0.2;
        }
        solid(c.t0, c.t1);
      }
      t = c.t1;
    }
    segment(t, L, 0, height, material);
    if (L > t) solid(t, L);
  }

  /** Glass wall with black frames (facades and offices). openings = open doors. */
  glassWall(ax, az, bx, bz, op = {}) {
    const { openings = [], frosted = false, strip = false, from = 0, to = HEIGHT } = op;
    const L = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / L, uz = (bz - az) / L;
    let t = 0;
    const segments = [];
    for (const h of [...openings].sort((a, b) => a[0] - b[0])) { segments.push([t, h[0]]); t = h[1]; }
    segments.push([t, L]);
    for (const [t0, t1] of segments) {
      if (t1 - t0 < 0.05) continue;
      this.walls.push({ ax: ax + ux * t0, az: az + uz * t0, bx: ax + ux * t1, bz: az + uz * t1 });
      this.#glass(ax + ux * t0, az + uz * t0, ax + ux * t1, az + uz * t1, from, to, frosted, strip);
    }
    for (const h of openings) {   // lintel over the door
      const a = [ax + ux * h[0], az + uz * h[0]], b = [ax + ux * h[1], az + uz * h[1]];
      this.#glass(a[0], a[1], b[0], b[1], 2.2, to, frosted, false);
    }
  }

  #glass(ax, az, bx, bz, y0, y1, frosted, strip) {
    if (this.dataOnly) return;
    const L = Math.hypot(bx - ax, bz - az), ang = Math.atan2(-(bz - az), bx - ax);
    const g = new THREE.Group();
    g.position.set((ax + bx) / 2, 0, (az + bz) / 2);
    g.rotation.y = ang;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(L, y1 - y0, 0.03), mat(frosted ? 'frosted' : 'glass'));
    panel.position.y = (y0 + y1) / 2;
    g.add(panel);
    if (strip) {   // frosted band (privacy) as in the glass offices
      const f = new THREE.Mesh(new THREE.BoxGeometry(L, 0.9, 0.035), mat('frosted'));
      f.position.y = Math.min(y1, 1.6) - 0.45;
      g.add(f);
    }
    // Black frames: posts every ~1.2 m and crossbars
    const n = Math.max(1, Math.round(L / 1.2));
    for (let i = 0; i <= n; i++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, y1 - y0, 0.07), mat('frame'));
      p.position.set(-L / 2 + (L * i) / n, (y0 + y1) / 2, 0);
      g.add(p);
    }
    for (const y of [y0 + 0.03, y1 - 0.03, Math.min(y1 - 0.05, 2.2)]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(L, 0.06, 0.07), mat('frame'));
      r.position.y = y;
      g.add(r);
    }
    this.scene.add(g);
  }

  /** Low frosted partition (clinic cubicles). */
  partition(ax, az, bx, bz, height = 1.8) {
    this.walls.push({ ax, az, bx, bz });
    if (this.dataOnly) return;
    const L = Math.hypot(bx - ax, bz - az), ang = Math.atan2(-(bz - az), bx - ax);
    const m = new THREE.Mesh(new THREE.BoxGeometry(L, height, 0.03), mat('partition'));
    m.position.set((ax + bx) / 2, 0.15 + height / 2, (az + bz) / 2);
    m.rotation.y = ang;
    this.scene.add(m);
    for (const [x, z] of [[ax, az], [bx, bz]]) this.box(0.05, HEIGHT, 0.05, 'steel', x, HEIGHT / 2, z).geometry = new THREE.CylinderGeometry(0.025, 0.025, HEIGHT, 8);
  }

  /** Door (leaf) drawn; open it shows the opening, closed it covers it. */
  door(x, z, rot, { width = 0.95, color = 'redDoor', isOpen = true, glass = false } = {}) {
    if (this.dataOnly) return;
    const g = new THREE.Group();
    const leaf = new THREE.Group();
    const m = glass ? 'glass' : color;
    const h = new THREE.Mesh(new THREE.BoxGeometry(width, 2.15, 0.05), mat(m));
    h.position.set(width / 2, 1.075, 0);
    leaf.add(h);
    if (glass) for (const [w, hh, y] of [[0.05, 2.15, 1.075]]) {
      const frame = new THREE.Mesh(new THREE.BoxGeometry(w, hh, 0.07), mat('frame')); frame.position.set(0.03, y, 0); leaf.add(frame);
      const frameBar2 = frame.clone(); frameBar2.position.x = width - 0.03; leaf.add(frameBar2);
    }
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.3, 0.06), mat('steel'));
    handle.position.set(width - 0.12, 1.05, 0.05);
    leaf.add(handle);
    leaf.position.x = -width / 2;
    leaf.rotation.y = isOpen ? -1.35 : 0;
    g.add(leaf);
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    this.scene.add(g);
  }

  /* ---------- stairs (always along z) */
  /**
   * Staircase between zIni and zFin. 'up' rises towards zFin; 'down' goes down towards zFin inside a pit.
   * It can be walked: the camera goes up or down with the steps.
   */
  staircase(x0, x1, zIni, zFin, dir = 'up', { railings = [true, true] } = {}) {
    const h = dir === 'up' ? 2.1 : -2.1;
    const za = Math.min(zIni, zFin), zb = Math.max(zIni, zFin);
    this.ramps.push({ x0, x1, z0: za, z1: zb, zIni, zFin, h });
    if (dir === 'down') this.openings.push({ x0, z0: za, x1, z1: zb });
    // the sides cannot be crossed
    if (railings[0]) this.walls.push({ ax: x0, az: zIni, bx: x0, bz: zFin });
    if (railings[1]) this.walls.push({ ax: x1, az: zIni, bx: x1, bz: zFin });
    this.walls.push({ ax: x0, az: zFin, bx: x1, bz: zFin });
    if (this.dataOnly) return;

    const n = Math.round(Math.abs(zFin - zIni) / 0.3), passage = (zFin - zIni) / n, riser = h / n;
    const width = x1 - x0, cx = (x0 + x1) / 2;
    for (let i = 0; i < n; i++) {
      const z = zIni + passage * (i + 0.5);
      const yHigh = dir === 'up' ? riser * (i + 1) : riser * (i + 1);
      const yLow = dir === 'up' ? 0 : yHigh - 0.25;
      const stepTread = this.box(width, Math.abs(yHigh - yLow), Math.abs(passage), 'stepTread', cx, (yHigh + yLow) / 2, z);
      stepTread.geometry = worldUV(stepTread.geometry, width, Math.abs(yHigh - yLow), Math.abs(passage), 1);
      this.box(width, 0.02, 0.05, 'frame', cx, yHigh + 0.01, zIni + passage * i + Math.sign(passage) * 0.03);
    }
    if (dir === 'down') {   // pit walls and bottom
      for (const x of [x0, x1]) this.box(0.12, 2.6, Math.abs(zFin - zIni), wallMaterial('brick'), x, -1.3, (zIni + zFin) / 2);
      this.box(width, 2.6, 0.12, wallMaterial('white'), cx, -1.3, zFin);
      this.box(width, 0.1, 1.2, 'stepTread', cx, h - 0.05, zFin + Math.sign(passage) * 0.6);
    } else {
      this.box(width, 0.3, Math.abs(zFin - zIni), 'stepTread', cx, HEIGHT - 0.15, (zIni + zFin) / 2).visible = false;
    }
    // metal railings
    for (const [x, ok] of [[x0 + 0.06, railings[0]], [x1 - 0.06, railings[1]]]) {
      if (!ok) continue;
      const L = Math.hypot(zFin - zIni, h);
      const rail = this.box(0.05, 0.05, L, 'frame', x, h / 2 + 0.95, (zIni + zFin) / 2);
      rail.lookAt(x, h + 0.95, zFin);
      for (let i = 0; i <= 4; i++) {
        const t = i / 4;
        this.box(0.04, 0.95, 0.04, 'frame', x, h * t + 0.47, zIni + (zFin - zIni) * t);
      }
    }
  }

  /* ---------- ceiling lighting */
  lamps(x0, z0, x1, z1, { passage = 3, axis = 'x', type = this.style.lamps } = {}) {
    if (this.dataOnly) return;
    for (let a = (axis === 'x' ? z0 : x0); a <= (axis === 'x' ? z1 : x1) + 0.01; a += passage) {
      for (let b = (axis === 'x' ? x0 : z0); b <= (axis === 'x' ? x1 : z1) + 0.01; b += 2.6) {
        const [x, z] = axis === 'x' ? [b, a] : [a, b];
        if (type === 'panel') this.box(0.6, 0.03, 0.6, 'light', x, HEIGHT - 0.02, z);
        else {
          this.box(axis === 'x' ? 1.25 : 0.16, 0.08, axis === 'x' ? 0.16 : 1.25, 'steel', x, HEIGHT - 0.06, z);
          this.box(axis === 'x' ? 1.2 : 0.1, 0.03, axis === 'x' ? 0.1 : 1.2, 'light', x, HEIGHT - 0.11, z);
        }
      }
    }
  }

  /** Exposed pipes and cable trays (floors 1 and 0). */
  pipes(ax, az, bx, bz, y = HEIGHT - 0.12, n = 2) {
    if (this.dataOnly) return;
    const L = Math.hypot(bx - ax, bz - az);
    for (let i = 0; i < n; i++) {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, L, 6), mat('tube'));
      c.position.set((ax + bx) / 2 + (bz !== az ? i * 0.09 : 0), y - (i % 2) * 0.04, (az + bz) / 2 + (bx !== ax ? i * 0.09 : 0));
      c.rotation.z = bz === az ? Math.PI / 2 : 0;
      c.rotation.x = bx === ax ? Math.PI / 2 : 0;
      this.scene.add(c);
    }
  }

  /* ---------- signs */
  sign(text, x, y, z, rot = 0, style = 'ucc', icon = null) {
    if (this.dataOnly) return;
    const { texture, width, height } = textureSign(text, style, icon);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map: texture, transparent: true, toneMapped: false }));
    m.position.set(x, y, z);
    m.rotation.y = rot;
    this.scene.add(m);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat('frame'));
    back.position.copy(m.position);
    back.rotation.y = rot + Math.PI;
    back.translateZ(0.005);
    this.scene.add(back);
    return m;
  }

  /** Flat image (mural, poster, floor decoration). */
  image(texture, width, height, x, y, z, rot = 0, floor = false) {
    if (this.dataOnly) return;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: texture, transparent: true, roughness: 0.8 }));
    m.position.set(x, y, z);
    if (floor) m.rotation.x = -Math.PI / 2;
    else m.rotation.y = rot;
    this.scene.add(m);
  }
}

function segmentDistance(px, pz, s) {
  const dx = s.bx - s.ax, dz = s.bz - s.az;
  const l2 = dx * dx + dz * dz || 1e-9;
  const t = THREE.MathUtils.clamp(((px - s.ax) * dx + (pz - s.az) * dz) / l2, 0, 1);
  return Math.hypot(px - (s.ax + t * dx), pz - (s.az + t * dz));
}

function subtractOpenings(r, openings) {
  let parts = [r];
  for (const h of openings) {
    const fresh = [];
    for (const p of parts) {
      if (h.x1 <= p.x0 || h.x0 >= p.x1 || h.z1 <= p.z0 || h.z0 >= p.z1) { fresh.push(p); continue; }
      if (h.z0 > p.z0) fresh.push({ x0: p.x0, x1: p.x1, z0: p.z0, z1: h.z0 });
      if (h.z1 < p.z1) fresh.push({ x0: p.x0, x1: p.x1, z0: h.z1, z1: p.z1 });
      const z0 = Math.max(p.z0, h.z0), z1 = Math.min(p.z1, h.z1);
      if (h.x0 > p.x0) fresh.push({ x0: p.x0, x1: h.x0, z0, z1 });
      if (h.x1 < p.x1) fresh.push({ x0: h.x1, x1: p.x1, z0, z1 });
    }
    parts = fresh;
  }
  return parts;
}

/** Adjusts the UVs of a box so the texture repeats every meter (brick, tile…). */
function worldUV(geo, w, h, d, stairSet = 1) {
  const uv = geo.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    uv.setXY(i, uv.getX(i) * dims[f][0] / stairSet, uv.getY(i) * dims[f][1] / stairSet);
  }
  uv.needsUpdate = true;
  return geo;
}

/* ======================================================================== Materials */
const materialCache = new Map();
export function mat(name) {
  if (materialCache.has(name)) return materialCache.get(name);
  const base = {
    ceiling: { color: '#f3f3f1', roughness: 1, emissive: '#d9dad8', emissiveIntensity: 0.3 },
    shadow: { color: '#000000', transparent: true, opacity: 0.32, depthWrite: false, alphaMap: textureShadow(), roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2 },
    steel: { color: '#b9c0c6', metalness: 0.7, roughness: 0.3 },
    frame: { color: '#24272a', metalness: 0.3, roughness: 0.6 },
    glass: { color: '#c9dde6', transparent: true, opacity: 0.2, roughness: 0.02, metalness: 0.5, depthWrite: false, envMapIntensity: 1.6 },
    frosted: { color: '#eef3f5', transparent: true, opacity: 0.82, roughness: 0.4 },
    partition: { color: '#e4efeb', transparent: true, opacity: 0.42, roughness: 0.3, depthWrite: false },
    light: { color: '#ffffff', emissive: '#ffffff', emissiveIntensity: 1.2 },
    tube: { color: '#c7cbcf', metalness: 0.5, roughness: 0.5 },
    stepTread: { map: textureTerrazzo('#cfcac2'), roughness: 0.7 },
    redDoor: { map: textureWood('#6e2219', '#5a1a13'), roughness: 0.45 },
    orangeDoor: { map: textureWood('#c46a2c', '#a8541f'), roughness: 0.45 },
    skirting: { color: '#3b3330', roughness: 0.6 },
    band: { map: textureWood('#5e3a24', '#4a2d1b'), roughness: 0.5 },
    yellowTube: { color: '#f2c230', roughness: 0.45, metalness: 0.2 },
    concrete: { color: '#bdb8b0', roughness: 0.95 },
    whiteDoor: { color: '#f1f1ee', roughness: 0.6 },
    wood: { color: '#b88a5a', roughness: 0.8 },
    darkWood: { color: '#6b4426', roughness: 0.8 },
    white: { color: '#f2f2ef', roughness: 0.8 },
    black: { color: '#202326', roughness: 0.6 },
  }[name];
  const m = new THREE.MeshStandardMaterial(base ?? { color: name, roughness: 0.7 });
  m.userData.shared = true;
  materialCache.set(name, m);
  return m;
}

function wallMaterial(type) {
  const password = 'wall:' + type;
  if (materialCache.has(password)) return materialCache.get(password);
  const m = type === 'brick' ? new THREE.MeshStandardMaterial({ map: textureBrick(), bumpMap: textureBrick(true), bumpScale: 2.5, roughness: 0.92 })
    : type === 'wood' ? new THREE.MeshStandardMaterial({ color: '#7a3f26', roughness: 0.7 })
    : type === 'cream' ? new THREE.MeshStandardMaterial({ color: '#efe6d6', roughness: 0.9 })
    : type === 'concrete' ? new THREE.MeshStandardMaterial({ color: '#bdb8b0', roughness: 0.95 })
    : new THREE.MeshStandardMaterial({ color: type === 'cream' ? '#efe6d6' : '#f1efea', map: texturePlaster(), roughness: 0.92 });
  m.userData.shared = true;
  materialCache.set(password, m);
  return m;
}

function floorMaterial(type, w, d) {
  // each floor needs its own texture repetition
  const tex = type === 'tile' ? textureTile()
    : type === 'beige' ? textureTerrazzo('#d8cab0', 256)
    : type === 'granite' ? textureGranite()
    : type === 'burgundy' ? textureTerrazzo('#76303a', 512, 0.6)
    : type === 'reddish' ? textureTerrazzo('#b9876a', 256)
    : textureTerrazzo('#d9d8d3', 256);
  const stairSet = type === 'tile' ? 1.2 : 2;
  tex.repeat.set(w / stairSet, d / stairSet);
  // polished floors: low roughness so they reflect the lamps as in the videos
  return new THREE.MeshStandardMaterial({ map: tex, roughness: type === 'tile' ? 0.12 : 0.22, metalness: 0.0, envMapIntensity: 1.3 });
}

function gridCeilingMaterial(w, d) {
  const tex = textureGridCeiling();
  tex.repeat.set(w / 1.2, d / 1.2);
  return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, emissive: '#77736c', emissiveIntensity: 0.35 });
}

/* ======================================================================== Textures */
function canvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return [cv, cv.getContext('2d')];
}
function texture(cv, repeat = true) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

let cvBrick, cvBrickBump;
/** Orange-red exposed brick of the hallways (1 m × 1 m), with its bump map. */
function textureBrick(bump = false) {
  if (!cvBrick) {
    const N = 512;
    const [cv, g] = canvas(N, N);
    const [cr, r] = canvas(N, N);
    g.fillStyle = '#cfc6b8'; g.fillRect(0, 0, N, N);       // mortar
    r.fillStyle = '#202020'; r.fillRect(0, 0, N, N);
    const rows = 14, height = N / rows, length = N / 4;
    let seed = 3;
    const random = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let f = 0; f < rows; f++) {
      const off = f % 2 ? length / 2 : 0;
      for (let x = -length; x < N + length; x += length) {
        const t = random();
        const base = [196 + t * 30, 92 + t * 26, 58 + t * 18];
        const x0 = x + off + 3, y0 = f * height + 3, w = length - 6, h = height - 6;
        const gr = g.createLinearGradient(x0, y0, x0, y0 + h);
        gr.addColorStop(0, `rgb(${base[0] + 10},${base[1] + 8},${base[2] + 6})`);
        gr.addColorStop(1, `rgb(${base[0] - 18},${base[1] - 12},${base[2] - 8})`);
        g.fillStyle = gr; g.fillRect(x0, y0, w, h);
        for (let i = 0; i < 40; i++) {                       // pores and stains
          g.fillStyle = `rgba(${random() < 0.5 ? '60,25,15' : '240,190,160'},${0.08 + random() * 0.12})`;
          g.fillRect(x0 + random() * w, y0 + random() * h, 1 + random() * 3, 1 + random() * 2);
        }
        r.fillStyle = `rgb(${200 + t * 40},${200 + t * 40},${200 + t * 40})`; r.fillRect(x0, y0, w, h);
      }
    }
    cvBrick = cv; cvBrickBump = cr;
  }
  return texture(bump ? cvBrickBump : cvBrick);
}

/** Radial gradient for the contact shadows. */
function textureShadow() {
  const [cv, g] = canvas(128, 128);
  const gr = g.createRadialGradient(64, 64, 8, 64, 64, 64);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.55, '#8a8a8a'); gr.addColorStop(1, '#000000');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(cv);
  return t;
}

/** White plaster with a light texture (so the walls do not look flat). */
let cvPlaster;
function texturePlaster() {
  if (!cvPlaster) {
    const [cv, g] = canvas(256, 256);
    g.fillStyle = '#f4f2ee'; g.fillRect(0, 0, 256, 256);
    let seed = 5;
    const random = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let i = 0; i < 5000; i++) {
      g.fillStyle = `rgba(${random() < 0.5 ? '120,115,105' : '255,255,255'},${0.04 + random() * 0.06})`;
      g.fillRect(random() * 256, random() * 256, 1 + random() * 3, 1 + random() * 3);
    }
    cvPlaster = cv;
  }
  return texture(cvPlaster);
}

/** Wood grain for doors and bands. */
function textureWood(a, b) {
  const [cv, g] = canvas(128, 256);
  g.fillStyle = a; g.fillRect(0, 0, 128, 256);
  let seed = 11;
  const random = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  g.strokeStyle = b; g.globalAlpha = 0.35;
  for (let i = 0; i < 26; i++) {
    g.lineWidth = 0.5 + random() * 2;
    const x = random() * 128;
    g.beginPath(); g.moveTo(x, 0);
    for (let y = 0; y <= 256; y += 16) g.lineTo(x + Math.sin(y / 40 + i) * 3, y);
    g.stroke();
  }
  g.globalAlpha = 1;
  return texture(cv);
}

/** Beige granite with veins (upper floors of Block B and Block A). */
function textureGranite() {
  const [cv, g] = canvas(512, 512);
  g.fillStyle = '#d7c7ae'; g.fillRect(0, 0, 512, 512);
  let seed = 21;
  const random = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 70; i++) {
    g.fillStyle = `rgba(${150 + random() * 60},${110 + random() * 40},${80 + random() * 30},0.25)`;
    g.beginPath(); g.ellipse(random() * 512, random() * 512, 10 + random() * 40, 5 + random() * 18, random() * 3, 0, 7); g.fill();
  }
  for (let i = 0; i < 9000; i++) {
    const v = random();
    g.fillStyle = v < 0.5 ? 'rgba(90,70,55,0.5)' : v < 0.85 ? 'rgba(250,245,235,0.8)' : 'rgba(180,90,70,0.5)';
    g.fillRect(random() * 512, random() * 512, 1 + random() * 2.5, 1 + random() * 2.5);
  }
  g.strokeStyle = 'rgba(120,105,90,0.35)'; g.lineWidth = 1.5;
  for (const p of [0, 256, 512]) { g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 512); g.stroke(); g.beginPath(); g.moveTo(0, p); g.lineTo(512, p); g.stroke(); }
  return texture(cv);
}

/** Exposed grid concrete ceiling of Block A (1.2 m coffers). */
let cvGrid;
function textureGridCeiling() {
  if (!cvGrid) {
    const [cv, g] = canvas(256, 256);
    g.fillStyle = '#a9a49c'; g.fillRect(0, 0, 256, 256);
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#8e8a83'); gr.addColorStop(0.5, '#b8b3ab'); gr.addColorStop(1, '#8e8a83');
    g.fillStyle = gr; g.fillRect(26, 26, 204, 204);
    g.fillStyle = '#c3beb6'; g.fillRect(44, 44, 168, 168);
    cvGrid = cv;
  }
  return texture(cvGrid);
}

function textureTerrazzo(base, side = 256, points = 1) {
  const [cv, g] = canvas(512, 512);
  g.fillStyle = base; g.fillRect(0, 0, 512, 512);
  let seed = 7;
  const random = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 9000 * points; i++) {
    const v = random();
    g.fillStyle = v < 0.45 ? 'rgba(70,70,70,0.55)' : v < 0.8 ? 'rgba(255,255,255,0.8)' : 'rgba(140,120,100,0.5)';
    const s = (1 + random() * 2.5) * (points < 1 ? 0.5 : 1);
    g.fillRect(random() * 512, random() * 512, s, s);
  }
  g.strokeStyle = 'rgba(120,120,120,0.35)'; g.lineWidth = 1.5;
  for (let p = 0; p <= 512; p += side) {
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 512); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(512, p); g.stroke();
  }
  return texture(cv);
}

function textureTile() {
  const [cv, g] = canvas(256, 256);   // 1.2 m: 60 cm tiles
  g.fillStyle = '#f4f5f6'; g.fillRect(0, 0, 256, 256);
  const gr = g.createLinearGradient(0, 0, 256, 256);
  gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(210,214,218,0.35)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#d3d8dc'; g.lineWidth = 2;
  for (const p of [0, 128, 256]) {
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, 256); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(256, p); g.stroke();
  }
  return texture(cv);
}

/** Signs like the ones on campus: 'ucc' (turquoise with a black band), 'colgate' (white with a red icon),
 *  'restrooms' (blue), 'exit' (green), 'floor' (small turquoise), 'ami', 'notice' (generic). */
function textureSign(text, style, icon) {
  const lines = Array.isArray(text) ? text : [text];
  const conf = {
    ucc: [512, 300, 0.75], floor: [512, 220, 0.6], colgate: [640, 210, 1.25], restrooms: [512, 120, 0.85],
    exit: [300, 110, 0.42], ami: [300, 480, 0.55], notice: [512, 200, 0.9], 'notice-blue': [512, 150, 0.7],
    'notice-dark': [512, 150, 0.8],
  }[style] ?? [512, 200, 0.9];
  const [W, H, width] = conf;
  const [cv, g] = canvas(W, H);
  const rounded = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); g.fill(); };
  const center = (ls, y0, size, color, weight = '600') => {
    g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
    ls.forEach((l, i) => {
      const t = i === ls.length - 1 && ls.length > 1 && l === l.toLowerCase() ? size * 0.75 : size;
      g.font = `${weight} ${t}px "Plus Jakarta Sans", sans-serif`;
      g.fillText(l, W / 2, y0 + i * size * 1.2);
    });
  };
  if (style === 'ucc' || style === 'floor') {
    g.fillStyle = '#2aa0b3'; rounded(0, 0, W, H, 26);
    g.fillStyle = '#121416'; g.fillRect(0, H * 0.72, W, H * 0.28);
    g.fillStyle = '#2aa0b3'; g.fillRect(0, H * 0.72, W, 4);
    g.strokeStyle = '#c4d93c'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(W / 2 - 16, H * 0.9); g.lineTo(W / 2, H * 0.8); g.lineTo(W / 2 + 16, H * 0.9); g.stroke();
    const size = style === 'floor' ? 40 : lines.length > 2 ? 36 : 44;
    center(lines, H * 0.36 - (lines.length - 1) * size * 0.6, size, '#f4fbfc', '500');
  } else if (style === 'colgate') {
    g.fillStyle = '#ffffff'; rounded(0, 0, W, H, 18);
    g.fillStyle = '#e1251b'; rounded(18, 22, 160, 160, 18);
    drawIcon(g, icon, 98, 102);
    g.fillStyle = '#2b2b2b'; g.textAlign = 'left'; g.textBaseline = 'middle';
    lines.forEach((l, i) => { g.font = `${i === 0 ? 600 : 500} ${i === 0 ? 46 : 38}px "Plus Jakarta Sans", sans-serif`; g.fillText(l, 205, 70 + i * 52); });
    g.fillStyle = '#e1251b'; g.fillRect(205, H - 22, W - 230, 4);
    g.font = 'italic bold 20px sans-serif'; g.textAlign = 'right'; g.fillText('Colgate', W - 24, H - 34);
  } else if (style === 'restrooms') {
    g.fillStyle = '#1c86b8'; rounded(0, 0, W, H, 14);
    g.fillStyle = '#ffffff'; rounded(14, 14, 92, 92, 8);
    g.fillStyle = '#1c86b8'; g.beginPath(); g.arc(60, 38, 9, 0, 7); g.fill(); g.fillRect(52, 50, 16, 40);
    center(lines, H / 2, 54, '#ffffff', '700');
  } else if (style === 'exit') {
    g.fillStyle = '#1e9440'; g.fillRect(0, 0, W, H);
    center(lines, H / 2, 58, '#eaffef', '700');
  } else if (style === 'ami') {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#1f8fa8'; g.font = 'italic 700 74px serif'; g.textAlign = 'center'; g.fillText('Ami', W / 2, 120);
    g.fillStyle = '#1f8fa8'; g.fillRect(0, 170, W, H - 170);
    g.fillStyle = '#ffffff'; g.font = '600 30px sans-serif'; g.textAlign = 'left';
    lines.forEach((l, i) => g.fillText(l, 26, 215 + i * 54));
  } else {
    const background = style === 'notice-blue' ? '#2c6db5' : style === 'notice-dark' ? '#2f3a44' : '#ffffff';
    g.fillStyle = background; rounded(0, 0, W, H, 10);
    center(lines, H / 2 - (lines.length - 1) * 22, lines.length > 2 ? 30 : 38, background === '#ffffff' ? '#24313c' : '#ffffff', '700');
  }
  return { texture: texture(cv, false), width, height: width * H / W };
}

function drawIcon(g, icon, cx, cy) {
  g.strokeStyle = '#ffffff'; g.fillStyle = '#ffffff'; g.lineWidth = 10; g.lineCap = 'round'; g.lineJoin = 'round';
  g.beginPath();
  if (icon === 'staircase') {
    g.moveTo(cx - 50, cy + 40); g.lineTo(cx - 25, cy + 40); g.lineTo(cx - 25, cy + 15); g.lineTo(cx, cy + 15);
    g.lineTo(cx, cy - 10); g.lineTo(cx + 25, cy - 10); g.lineTo(cx + 25, cy - 35); g.lineTo(cx + 50, cy - 35); g.stroke();
  } else if (icon === 'archive') {
    g.lineWidth = 6; g.strokeRect(cx - 50, cy - 40, 100, 80);
    for (let i = 0; i < 4; i++) g.fillRect(cx - 40 + i * 22, cy - 28, 12, 56);
  } else {   // dental chair
    g.moveTo(cx - 45, cy - 30); g.lineTo(cx - 20, cy + 10); g.lineTo(cx + 40, cy + 10); g.stroke();
    g.beginPath(); g.moveTo(cx - 5, cy + 10); g.lineTo(cx - 5, cy + 40); g.stroke();
    g.beginPath(); g.arc(cx - 45, cy - 38, 9, 0, 7); g.fill();
  }
}

export { textureTerrazzo, canvas, texture };
