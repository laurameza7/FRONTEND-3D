import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

/*
 * 3D model of the Pasto campus (Calle 18 N.º 45-150, Torobajo).
 * Coordinates in meters: x towards Carrera 45 (east), z towards Calle 18 (front).
 * The buildings come from the backend; streets, neighborhood and vegetation are decoration.
 */
const FLOOR_HEIGHT = 3.6;
const BASEMENT_HEIGHT = 3.2;
const BASEMENT_GAP = 9;  // in the basement view the levels are separated so they can be read
const STREET_18_Z = 40;     // axis of Calle 18
const AVENUE_45_X = 54;   // axis of Carrera 45
const OVERVIEW_VIEW = { camera: new THREE.Vector3(-58, 52, 88), goal: new THREE.Vector3(10, 6, -10) };
const BASEMENTS_VIEW = { camera: new THREE.Vector3(-30, 14, 70), goal: new THREE.Vector3(12, -10, -12) };

export class Campus3D {
  constructor(container, { onSelect } = {}) {
    this.container = container;
    this.onSelect = onSelect;
    this.blocks = new Map();       // id -> { group, label, data, materials }
    this.selected = null;
    this.animation = null;
    this.basementsVisible = false;

    this.#createScene();
    this.#createEnvironment();
    this.#events();
    this.renderer.setAnimationLoop(() => this.#picture());
  }

  /* ================================================================ Base scene */
  #createScene() {
    const { clientWidth: w, clientHeight: h } = this.container;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#dce8f2');
    this.scene.fog = new THREE.Fog('#dce8f2', 220, 420);

    this.camera = new THREE.PerspectiveCamera(42, w / h, 0.5, 900);
    this.camera.position.copy(OVERVIEW_VIEW.camera);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    // Soft sky reflections on glass and metal
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.35;
    pmrem.dispose();
    this.container.appendChild(this.renderer.domElement);

    this.labels = new CSS2DRenderer();
    this.labels.setSize(w, h);
    Object.assign(this.labels.domElement.style, { position: 'absolute', top: '0', pointerEvents: 'none' });
    this.container.appendChild(this.labels.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.minDistance = 20;
    this.controls.maxDistance = 260;
    this.controls.target.copy(OVERVIEW_VIEW.goal);

    this.scene.add(new THREE.HemisphereLight('#ffffff', '#8fa08a', 1.25));
    const sun = new THREE.DirectionalLight('#fff6e8', 1.9);
    sun.position.set(70, 120, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, far: 320 });
    this.scene.add(sun);
  }

  /* ================================================================ Streets, neighborhood and mountains */
  #createEnvironment() {
    // Ground (it turns translucent when showing the basements)
    this.groundMaterial = new THREE.MeshStandardMaterial({ color: '#c9cdc6', roughness: 1 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), this.groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Campus lot
    this.lotMaterial = new THREE.MeshStandardMaterial({ color: '#d9d4c8', roughness: 1 });
    const lot = new THREE.Mesh(new THREE.PlaneGeometry(76, 82), this.lotMaterial);
    lot.rotation.x = -Math.PI / 2;
    lot.position.set(8, 0.02, -7);
    lot.receiveShadow = true;
    this.scene.add(lot);
    this.grounds = [this.groundMaterial, this.lotMaterial];

    // Calle 18 and Carrera 45
    const asphalt = new THREE.MeshStandardMaterial({ color: '#4a4f55', roughness: 0.95 });
    const sidewalk = new THREE.MeshStandardMaterial({ color: '#b9b5ad', roughness: 1 });
    this.#floorPlan(320, 12, 0, STREET_18_Z, asphalt, 0.04);
    this.#floorPlan(320, 3, 0, STREET_18_Z - 7.5, sidewalk, 0.06);
    this.#floorPlan(320, 3, 0, STREET_18_Z + 7.5, sidewalk, 0.06);
    this.#floorPlan(10, 320, AVENUE_45_X, -100, asphalt, 0.05);
    this.#floorPlan(2.5, 280, AVENUE_45_X - 6.2, -110, sidewalk, 0.06);
    this.#floorPlan(2.5, 280, AVENUE_45_X + 6.2, -110, sidewalk, 0.06);
    const line = new THREE.MeshBasicMaterial({ color: '#f2d36b' });
    for (let x = -150; x < 160; x += 9) this.#floorPlan(4, 0.25, x, STREET_18_Z, line, 0.07);
    for (let z = -250; z < 30; z += 9) this.#floorPlan(0.25, 4, AVENUE_45_X, z, line, 0.07);
    this.#label('Calle 18', new THREE.Vector3(-40, 0.5, STREET_18_Z), 'label-street');
    this.#label('Carrera 45', new THREE.Vector3(AVENUE_45_X, 0.5, -70), 'label-street');

    // Surrounding neighborhood (low blocks, fixed positions)
    this.neighborhood = new THREE.Group();
    this.scene.add(this.neighborhood);
    const colors = ['#d8d2c4', '#c9c3b8', '#e2dcd0', '#bfb9ad', '#d3c6b4', '#cfd4d8'];
    let seed = 11;
    const random = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const house = (x, z) => {
      const w = 7 + random() * 9, d = 7 + random() * 9, h = 3 + Math.floor(random() * 4) * 3;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: colors[Math.floor(random() * colors.length)], roughness: 0.95 }));
      m.position.set(x, h / 2, z);
      m.castShadow = m.receiveShadow = true;
      this.neighborhood.add(m);
    };
    for (let x = -110; x <= 120; x += 15) for (let z = STREET_18_Z + 16; z <= 120; z += 15) house(x + random() * 3, z + random() * 3);
    for (let x = AVENUE_45_X + 15; x <= 130; x += 15) for (let z = -120; z < STREET_18_Z - 10; z += 15) house(x + random() * 3, z + random() * 3);
    for (let x = -110; x < -36; x += 15) for (let z = -120; z < STREET_18_Z - 10; z += 15) house(x + random() * 3, z + random() * 3);
    for (let x = -30; x < AVENUE_45_X - 12; x += 15) for (let z = -130; z < -56; z += 15) house(x + random() * 3, z + random() * 3);

    // Green mountains in the background (as in the campus photos)
    const green = new THREE.MeshStandardMaterial({ color: '#7f9f6a', roughness: 1, flatShading: true });
    [[-200, -380, 150, 55], [-20, -400, 170, 70], [170, -380, 150, 50]].forEach(([x, z, r, h]) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), green);
      m.scale.set(r, h, r * 0.7);
      m.position.set(x, 0, z);
      this.scene.add(m);
    });

    // Basements (shown with the "Ver sótanos" button)
    this.basementGroup = new THREE.Group();
    this.basementGroup.visible = false;
    this.scene.add(this.basementGroup);
  }

  #floorPlan(w, d, x, z, material, y = 0.03) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    m.receiveShadow = true;
    this.scene.add(m);
    return m;
  }

  #label(text, position, cssClass = 'label-3d', parent = this.scene) {
    const div = document.createElement('div');
    div.className = cssClass;
    div.textContent = text;
    const obj = new CSS2DObject(div);
    obj.position.copy(position);
    parent.add(obj);
    return div;
  }

  /* ================================================================ Backend data */
  load(buildings, places = []) {
    for (const e of buildings) {
      const placesOf = places.filter(l => l.buildingId === e.id);
      let group;
      if (e.type === 'BUILDING') group = this.#building(e, placesOf);
      else if (e.type === 'ENTRANCE') group = this.#entrancePavilion(e);
      else if (e.type === 'GREEN_AREA') group = this.#trail(e);
      else if (e.type === 'BIKE_STATION') group = this.#bikeStation(e);
      else if (e.type === 'PLAZA') group = this.#tablesPlaza(e);
      else group = this.#floor(e);

      group.position.set(e.x, 0, e.z);
      group.traverse(o => { o.userData.id = e.id; });
      this.scene.add(group);

      const heightAt = { BUILDING: e.floors * FLOOR_HEIGHT + 8, ENTRANCE: 12, BIKE_STATION: 5, PLAZA: 5 }[e.type] ?? 2;
      const label = this.#label(e.name, new THREE.Vector3(0, heightAt, 0), 'label-3d', group);

      const materials = [];
      group.traverse(o => {
        const ms = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        ms.forEach(m => { if (m.emissive && !materials.includes(m)) materials.push(m); });
      });
      this.blocks.set(e.id, { group, label, data: e, materials });
    }
    this.#basements(buildings.filter(e => e.type === 'BUILDING' && e.basements > 0), places);
  }

  /* ---------------------------------------------------------------- Brick blocks */
  #building(e, places) {
    const group = new THREE.Group();
    const height = e.floors * FLOOR_HEIGHT;
    const withBays = e.code === 'B';   // Block B has vertical glass bays
    const withCourts = places.some(l => l.type === 'SPORTS' && l.floor >= e.floors);

    const longFacade = textureFacade(e.width, e.floors, e.color, withBays);
    const shortFacade = textureFacade(e.depth, e.floors, e.color, withBays);
    const side = (tex) => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
    const ceiling = new THREE.MeshStandardMaterial({ color: withCourts ? '#5d6166' : '#c8643a', roughness: 0.9 });
    const base = new THREE.MeshStandardMaterial({ color: '#6b6f73' });
    // face order in BoxGeometry: +x, -x, +y, -y, +z, -z
    const body = new THREE.Mesh(new THREE.BoxGeometry(e.width, height, e.depth),
      [side(shortFacade), side(shortFacade), ceiling, base, side(longFacade), side(longFacade)]);
    body.position.y = height / 2;
    body.castShadow = body.receiveShadow = true;
    group.add(body);

    // Roof parapet
    const parapet = new THREE.Mesh(
      new THREE.BoxGeometry(e.width + 0.4, 1.1, e.depth + 0.4),
      new THREE.MeshStandardMaterial({ color: e.color, roughness: 0.9 }));
    parapet.position.y = height + 0.55;
    const opening = new THREE.Mesh(new THREE.BoxGeometry(e.width - 0.6, 0.9, e.depth - 0.6), ceiling);
    opening.position.y = height + 0.45;
    group.add(parapet, opening);

    if (withCourts) this.#courts(group, e, height + 1.2);
    else this.#roofEquipment(group, e, height + 0.95);
    if (e.code === 'B') this.#blockBEntrance(group, e);
    if (e.code === 'A') this.#blockALogo(group, e, height);
    return group;
  }

  /** Entrance of Block B on the path: glass doors, sign and ramps with railings. */
  #blockBEntrance(group, e) {
    const x = -e.width / 2;
    const frame = new THREE.MeshStandardMaterial({ color: '#2b2f33', metalness: 0.4 });
    const glass = new THREE.MeshStandardMaterial({ color: '#7fb4c9', transparent: true, opacity: 0.55, metalness: 0.3 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.8, 5), glass);
    door.position.set(x - 0.05, 1.4, 0);
    const overhang = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 7), new THREE.MeshStandardMaterial({ color: '#e9e6df' }));
    overhang.position.set(x - 0.8, 3.2, 0);
    const notice = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 2.4), [
      new THREE.MeshStandardMaterial({ map: textureText('BLOQUE B', '#1f9bb0', '#ffffff', 256, 80) }), frame, frame, frame, frame, frame]);
    notice.rotation.y = Math.PI;
    notice.position.set(x - 0.12, 3.8, 0);
    group.add(door, overhang, notice);
    // Ramps on both sides of the door and low walls
    const rampMaterial = new THREE.MeshStandardMaterial({ color: '#cfcac1', roughness: 1 });
    const wall = new THREE.MeshStandardMaterial({ color: '#7c7d6b' });
    for (const side of [-1, 1]) {
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 7), rampMaterial);
      ramp.position.set(x - 3, 0.35, side * 6.2);
      ramp.rotation.x = side * 0.07;
      const parapet = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1, 7.5), wall);
      parapet.position.set(x - 4.3, 0.5, side * 6.2);
      const railing = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 7.5), frame);
      railing.position.set(x - 4.3, 1.2, side * 6.2);
      group.add(ramp, parapet, railing);
    }
    const plaza = new THREE.Mesh(new THREE.BoxGeometry(4, 0.12, 5), rampMaterial);
    plaza.position.set(x - 2, 0.06, 0);
    group.add(plaza);
  }

  /** University logo at the top of the Block A facade that faces the path. */
  #blockALogo(group, e, height) {
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.1),
      new THREE.MeshStandardMaterial({ map: textureOfficialLogo(900, 310, null, 1), transparent: true }));
    logo.position.set(-e.width / 2 + 7, height - 1.6, e.depth / 2 + 0.06);
    group.add(logo);
  }

  #courts(group, e, y) {
    const lines = new THREE.LineBasicMaterial({ color: '#ffffff' });
    const court = (w, d, x, color, name) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.12, d), new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
      m.position.set(x, y, 0);
      m.receiveShadow = true;
      group.add(m);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(w - 1.2, 0.01, d - 1.2)), lines);
      edge.position.set(x, y + 0.08, 0);
      const half = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, d - 1.2), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
      half.position.set(x, y + 0.08, 0);
      group.add(edge, half);
      this.#label(name, new THREE.Vector3(x, y + 1.5, 0), 'label-mini', group);
      return m;
    };
    const sep = e.width * 0.24;
    court(Math.min(22, e.width * 0.5), Math.min(14, e.depth - 4), -sep, '#3f9a52', 'Cancha sintética');
    court(Math.min(16, e.width * 0.36), Math.min(9, e.depth - 6), sep + 2, '#d7b98a', 'Voleibol');
    // Perimeter fence and volleyball net
    const fence = new THREE.Mesh(new THREE.BoxGeometry(e.width - 0.8, 4, e.depth - 0.8),
      new THREE.MeshBasicMaterial({ color: '#2c3e50', wireframe: true, transparent: true, opacity: 0.18 }));
    fence.position.y = y + 2;
    const net = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, Math.min(9, e.depth - 6)),
      new THREE.MeshStandardMaterial({ color: '#f5f5f5', transparent: true, opacity: 0.8 }));
    net.position.set(sep + 2, y + 2.4, 0);
    group.add(fence, net);
  }

  #roofEquipment(group, e, y) {
    // Solar panels and equipment as seen in the satellite view
    const panel = new THREE.MeshStandardMaterial({ color: '#273445', metalness: 0.4, roughness: 0.35 });
    for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.15, 1.8), panel);
      p.position.set(-e.width / 2 + 3 + j * 3.6, y + 0.3, -e.depth / 2 + 3 + i * 2.2);
      p.rotation.z = 0.15;
      group.add(p);
    }
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 1.8, 16), new THREE.MeshStandardMaterial({ color: '#3b6fb6' }));
    tank.position.set(e.width / 2 - 3, y + 0.9, e.depth / 2 - 4);
    group.add(tank);
  }

  /* ---------------------------------------------------------------- Entrance pavilion */
  /*
   * As in the photos: a sloped polycarbonate roof on steel trusses that rises
   * towards the corner of the UCC sign; below it, glass facades with posters, a wooden
   * wall, the Comuna and Bonne Vie shops, the turnstile entrance and the terrace.
   */
  #entrancePavilion(e) {
    const g = new THREE.Group();
    const W = e.width, D = e.depth;
    const steel = new THREE.MeshStandardMaterial({ color: '#9aa3aa', metalness: 0.6, roughness: 0.35 });
    const glass = new THREE.MeshStandardMaterial({ color: '#a9c7d8', transparent: true, opacity: 0.4, roughness: 0.1, metalness: 0.3 });
    const polycarbonate = new THREE.MeshStandardMaterial({ color: '#eef2f4', transparent: true, opacity: 0.55, side: THREE.DoubleSide, roughness: 0.3 });
    const wood = new THREE.MeshStandardMaterial({ color: '#7a3f26', roughness: 0.7 });
    const floor = new THREE.MeshStandardMaterial({ color: '#b9b5ae', roughness: 0.9 });

    // Indoor floor and herringbone brick plaza in front
    const base = new THREE.Mesh(new THREE.BoxGeometry(W, 0.15, D), floor);
    base.position.y = 0.075; base.receiveShadow = true;
    const plaza = new THREE.Mesh(new THREE.BoxGeometry(W + 10, 0.1, 6),
      new THREE.MeshStandardMaterial({ map: textureHerringbone(), roughness: 1 }));
    plaza.position.set(-2, 0.05, D / 2 + 3); plaza.receiveShadow = true;
    g.add(base, plaza);

    // Sloped roof: low at the west end (5 m), high at the sign (10 m)
    const heightAt = (x) => 5 + (x + W / 2) / W * 5;
    const shape = new THREE.Shape();
    shape.moveTo(-W / 2 - 1.5, heightAt(-W / 2 - 1.5));
    shape.lineTo(W / 2 + 0.5, heightAt(W / 2 + 0.5));
    shape.lineTo(W / 2 + 0.5, heightAt(W / 2 + 0.5) - 0.25);
    shape.lineTo(-W / 2 - 1.5, heightAt(-W / 2 - 1.5) - 0.25);
    shape.closePath();
    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: D + 3, bevelEnabled: false }), polycarbonate);
    roof.position.z = -D / 2 - 1;
    roof.castShadow = true;
    g.add(roof);
    // Trusses (beams and diagonals) under the roof
    for (let x = -W / 2; x <= W / 2 + 0.01; x += W / 6) {
      const h = heightAt(x);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, D + 3), steel);
      beam.position.set(x, h - 0.35, 0.5);
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, h, 8), steel);
      column.position.set(x, h / 2, D / 2 + 1);
      g.add(beam, column);
      for (let z = -D / 2; z < D / 2 + 1; z += 2.4) {
        const diag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 2.8), steel);
        diag.position.set(x, h - 0.9, z + 1.2);
        diag.rotation.x = 0.4;
        g.add(diag);
      }
    }
    for (let z = -D / 2; z <= D / 2 + 2; z += 2.4) {
      const belt = new THREE.Mesh(new THREE.BoxGeometry(W + 2, 0.1, 0.1), steel);
      belt.position.set(-0.5, (heightAt(-W / 2) + heightAt(W / 2)) / 2 - 0.3, z);
      belt.rotation.z = Math.atan2(heightAt(W / 2) - heightAt(-W / 2), W);
      g.add(belt);
    }

    // Front facade: glass with posters (left), sloped wooden wall, shops (right)
    const posters = new THREE.Mesh(new THREE.BoxGeometry(W * 0.42, 3.6, 0.15), [
      glass, glass, glass, glass, new THREE.MeshStandardMaterial({ map: texturePosters() }), glass]);
    posters.position.set(-W / 2 + W * 0.21, 1.8, D / 2);
    const woodWall = new THREE.Mesh(new THREE.BoxGeometry(W * 0.16, 4.2, 0.3), wood);
    woodWall.position.set(-W / 2 + W * 0.5, 2.1, D / 2 - 1.5);
    const shops = new THREE.Mesh(new THREE.BoxGeometry(W * 0.4, 3.4, 0.15), [
      glass, glass, glass, glass, new THREE.MeshStandardMaterial({ map: textureShops() }), glass]);
    shops.position.set(W / 2 - W * 0.2, 1.7, D / 2 - 0.5);
    g.add(posters, woodWall, shops);

    // Big white UCC sign over the shops
    const notice = new THREE.Mesh(new THREE.BoxGeometry(8, 5.2, 0.4), [
      steel, steel, steel, steel, new THREE.MeshStandardMaterial({ map: textureOfficialLogo(640, 416, '#f7f8f8', 0.86) }), steel]);
    notice.position.set(W / 2 - 5.2, 6.4, D / 2 - 0.2);
    notice.castShadow = true;
    // Academic offer panel next to the sign
    const billboard = new THREE.Mesh(new THREE.BoxGeometry(3.4, 4.2, 0.15), [
      steel, steel, steel, steel, new THREE.MeshStandardMaterial({ map: textureProgramsSign() }), steel]);
    billboard.position.set(W / 2 - 11.2, 5.6, D / 2 - 0.4);
    g.add(notice, billboard);

    // Totem with the university shield on the plaza, facing Calle 18
    const totem = new THREE.Group();
    const stone = new THREE.MeshStandardMaterial({ color: '#5d6166', roughness: 0.85 });
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(7.4, 0.6, 1.6), stone);
    pedestal.position.y = 0.3;
    const plate = new THREE.Mesh(new THREE.BoxGeometry(7, 2.6, 0.35), [
      stone, stone, stone, stone, new THREE.MeshStandardMaterial({ map: textureOfficialLogo(1024, 380, '#ffffff', 0.92), roughness: 0.4 }), stone]);
    plate.position.y = 1.95;
    pedestal.castShadow = plate.castShadow = true;
    const planter = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.35, 2.4), new THREE.MeshStandardMaterial({ color: '#5f8f4a', roughness: 1 }));
    planter.position.set(0, 0.18, 0.3);
    totem.add(planter, pedestal, plate);
    totem.position.set(-W / 2 + 4.5, 0, D / 2 + 4.6);
    g.add(totem);
    this.#label('Escudo UCC · Entrada principal', new THREE.Vector3(-W / 2 + 4.5, 4, D / 2 + 4.6), 'label-mini', g);

    // Entrance desk: light wood counter, turnstiles and blue chairs
    const worktop = new THREE.Mesh(new THREE.BoxGeometry(5, 1.1, 1.4), new THREE.MeshStandardMaterial({ color: '#d8c3a0' }));
    worktop.position.set(-1, 0.7, -0.5);
    g.add(worktop);
    for (let i = 0; i < 3; i++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1, 1.1), steel);
      t.position.set(-3.5 + i * 1.2, 0.65, 1.8);
      g.add(t);
    }
    const chairs = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 3), new THREE.MeshStandardMaterial({ color: '#2f4fa3' }));
    chairs.position.set(-W / 2 + 1.2, 0.5, 0);
    g.add(chairs);

    // Bonne Vie terrace with tables and umbrellas
    for (let i = 0; i < 3; i++) g.add(table(W / 2 + 2.2, D / 2 - 2 - i * 3, i === 1));
    // Ecological paver ramp on the side
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(5, 0.12, D + 4),
      new THREE.MeshStandardMaterial({ map: textureGrassPavers(), roughness: 1 }));
    ramp.position.set(W / 2 + 2.5, 0.04, -1);
    ramp.receiveShadow = true;
    g.add(ramp);
    return g;
  }

  /* ---------------------------------------------------------------- Cypress path */
  #trail(e) {
    const g = new THREE.Group();
    const L = e.depth;
    const board = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.14, L),
      new THREE.MeshStandardMaterial({ map: textureDiagonalTile(L), roughness: 0.9 }));
    board.position.y = 0.07; board.receiveShadow = true;
    const grass = new THREE.MeshStandardMaterial({ color: '#6fa25a', roughness: 1 });
    const bandRight = new THREE.Mesh(new THREE.BoxGeometry(3, 0.25, L - 2), grass);
    bandRight.position.set(4.1, 0.12, 0);
    const bandLeft = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.25, L - 6), grass);
    bandLeft.position.set(-3.7, 0.12, 2);
    const paver = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.1, L),
      new THREE.MeshStandardMaterial({ map: textureGrassPavers(), roughness: 1 }));
    paver.position.set(-6.1, 0.05, 0);
    g.add(board, bandRight, bandLeft, paver);
    // Cypresses on both sides
    for (let z = -L / 2 + 3; z < L / 2 - 1; z += 4.2) {
      g.add(cypress(3.4, z, 7 + ((z * 7) % 3 + 3) % 3));
      g.add(cypress(-3.3, z + 2, 6.5 + ((z * 5) % 2 + 2) % 2));
    }
    // Stone walls of the planters (left) and flowers
    const stone = new THREE.MeshStandardMaterial({ color: '#6b5a50', roughness: 1, flatShading: true });
    for (const [z, length] of [[6, 8], [-4, 6]]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, length), stone);
      wall.position.set(-7.6, 0.45, z);
      g.add(wall);
    }
    for (let z = -L / 2 + 2; z < L / 2 - 2; z += 2.5) g.add(flowers(5.2, z));
    // Palms and yuccas next to Block B
    for (const z of [-10, 2, 12]) g.add(palm(6.4, z));
    // Lamp posts
    for (const z of [-12, 0, 12]) g.add(post(-2.9, z));
    return g;
  }

  /* ---------------------------------------------------------------- UrkuBici station */
  #bikeStation(e) {
    const g = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.BoxGeometry(e.width, 0.1, e.depth),
      new THREE.MeshStandardMaterial({ map: textureHerringbone(), roughness: 1 }));
    floor.position.y = 0.05; floor.receiveShadow = true;
    g.add(floor);
    // Solar panel roof on V-shaped supports
    const black = new THREE.MeshStandardMaterial({ color: '#2c3136', metalness: 0.5 });
    const panel = new THREE.Mesh(new THREE.BoxGeometry(e.width - 2, 0.15, 4.2),
      new THREE.MeshStandardMaterial({ color: '#1f2e44', metalness: 0.5, roughness: 0.3 }));
    panel.position.set(0, 3.1, 0); panel.rotation.x = -0.12; panel.castShadow = true;
    g.add(panel);
    for (const x of [-e.width / 2 + 2, 0, e.width / 2 - 2]) for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 3.3, 0.15), black);
      leg.position.set(x + s * 0.7, 1.6, 0.3); leg.rotation.z = s * 0.25;
      g.add(leg);
    }
    // White bicycles
    for (let i = 0; i < 10; i++) g.add(bicycle(-e.width / 2 + 1.5 + i * 0.95, 0.4));
    // Neighboring brick booth
    const booth = new THREE.Mesh(new THREE.BoxGeometry(4, 2.8, 5), new THREE.MeshStandardMaterial({ color: '#b0583f' }));
    booth.position.set(-e.width / 2 - 3, 1.4, 6); booth.castShadow = true;
    g.add(booth);
    return g;
  }

  /* ---------------------------------------------------------------- Tables plaza */
  #tablesPlaza(e) {
    const g = new THREE.Group();
    const floor = new THREE.Mesh(new THREE.BoxGeometry(e.width, 0.1, e.depth),
      new THREE.MeshStandardMaterial({ map: textureGrassPavers(), roughness: 1 }));
    floor.position.y = 0.05; floor.receiveShadow = true;
    g.add(floor);
    for (const [x, z] of [[-3, 1], [1.5, 3.5], [3.5, -0.5]]) g.add(table(x, z, false));
    // Game room: white pavilion with a light roof and narrow windows
    const room = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 4.5), new THREE.MeshStandardMaterial({ color: '#f3f3f1' }));
    room.position.set(-1, 1.5, -e.depth / 2 + 2.5); room.castShadow = true;
    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.25, 5), new THREE.MeshStandardMaterial({ color: '#dfe3e6' }));
    ceiling.position.set(-1, 3.1, -e.depth / 2 + 2.5);
    const brick = new THREE.Mesh(new THREE.BoxGeometry(3, 2.6, 4), new THREE.MeshStandardMaterial({ color: '#b0583f' }));
    brick.position.set(4.5, 1.3, -e.depth / 2 + 2.3);
    g.add(room, ceiling, brick);
    // Concrete steps in front and meeting point sign
    const concrete = new THREE.MeshStandardMaterial({ color: '#cfc9bd' });
    for (let i = 0; i < 3; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(e.width, 0.3 * (i + 1), 0.8), concrete);
      step.position.set(0, 0.15 * (i + 1), e.depth / 2 + 0.4 + (2 - i) * 0.8);
      g.add(step);
    }
    const pe = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.05),
      new THREE.MeshStandardMaterial({ map: textureText('PE', '#2e9b4f', '#ffffff', 64, 80) }));
    pe.position.set(e.width / 2 - 1, 2, 2);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2, 6), new THREE.MeshStandardMaterial({ color: '#cccccc' }));
    post.position.set(e.width / 2 - 1, 1, 2);
    g.add(pe, post);
    return g;
  }

  /* ---------------------------------------------------------------- Generic area */
  #floor(e) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(e.width, 0.1, e.depth),
      new THREE.MeshStandardMaterial({ color: e.color, roughness: 1 }));
    m.position.y = 0.05; m.receiveShadow = true;
    g.add(m);
    return g;
  }

  /* ---------------------------------------------------------------- Connected basements */
  /*
   * Each basement is a translucent slab; inside, the rooms the database has on that level
   * (negative floor) are drawn as colored boxes, spread along the block.
   */
  #basements(buildings, places) {
    const slabMaterial = new THREE.MeshStandardMaterial({ color: '#5b84b1', transparent: true, opacity: 0.28, depthWrite: false });
    const floor = new THREE.MeshStandardMaterial({ color: '#dfe5ec' });
    const edge = new THREE.LineBasicMaterial({ color: '#dfe9f5' });
    const colors = { CLINIC: '#e2574c', LABORATORY: '#8e6cc8', OFFICE: '#3d7cc9', SERVICE: '#2fa37a', SAFETY: '#e0a526' };
    for (const e of buildings) {
      for (let s = 1; s <= e.basements; s++) {
        const y0 = -s * BASEMENT_GAP;
        const level = new THREE.Mesh(new THREE.BoxGeometry(e.width, BASEMENT_HEIGHT - 0.3, e.depth), slabMaterial);
        level.position.set(e.x, y0 + BASEMENT_HEIGHT / 2, e.z);
        level.userData.id = e.id;
        const slab = new THREE.Mesh(new THREE.BoxGeometry(e.width, 0.2, e.depth), floor);
        slab.position.set(e.x, y0 + 0.1, e.z);
        slab.userData.id = e.id;
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(level.geometry), edge);
        edges.position.copy(level.position);
        this.basementGroup.add(level, slab, edges);

        const levelName = e.code === 'B' && s === 1 ? 'Piso 0 (sótano 1)' : `Sótano ${s}`;
        this.#label(`${e.name} · ${levelName}`, new THREE.Vector3(e.x - e.width / 2, y0 + 3.2, e.z + e.depth / 2), 'label-level', this.basementGroup);

        // Rooms on this level
        const here = places.filter(l => l.buildingId === e.id && l.floor === -s && l.type !== 'PASSAGE');
        if (!here.length) continue;
        const length = Math.max(e.width, e.depth), short = Math.min(e.width, e.depth);
        const alongZ = e.depth >= e.width;
        const rows = here.length > 2 ? 2 : 1;
        const perRow = Math.ceil(here.length / rows);
        const cell = (length - 2) / perRow, width = (short - 2) / rows;
        here.forEach((l, i) => {
          const f = Math.floor(i / perRow), c = i % perRow;
          const a = -length / 2 + 1 + cell * (c + 0.5), b = -short / 2 + 1 + width * (f + 0.5);
          const enclosure = new THREE.Mesh(
            new THREE.BoxGeometry(alongZ ? width - 0.8 : cell - 0.8, 2, alongZ ? cell - 0.8 : width - 0.8),
            new THREE.MeshStandardMaterial({ color: colors[l.type] ?? '#7d8b99', transparent: true, opacity: 0.85 }));
          enclosure.position.set(e.x + (alongZ ? b : a), y0 + 1.2, e.z + (alongZ ? a : b));
          enclosure.userData.id = e.id;
          this.basementGroup.add(enclosure);
          this.#label(l.name.replace(' de la Clínica Odontológica', '').replace(' de la clínica', ''), enclosure.position.clone().add(new THREE.Vector3(0, 1.3 + (i % 2) * 1.6, 0)), 'label-basement', this.basementGroup);
        });
      }
    }
    // Underground connection between blocks
    if (buildings.length >= 2) {
      const [a, b] = buildings;
      const yT = -BASEMENT_GAP + 1.3;
      const start = new THREE.Vector3(a.x, yT, a.z);
      const end = new THREE.Vector3(b.x, yT, b.z);
      const length = start.distanceTo(end);
      const tunnel = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, length), new THREE.MeshStandardMaterial({ color: '#f0b429', transparent: true, opacity: 0.6 }));
      tunnel.position.copy(start).lerp(end, 0.5);
      tunnel.lookAt(end);
      this.basementGroup.add(tunnel);
      this.#label('Conexión subterránea A–B', tunnel.position.clone().add(new THREE.Vector3(0, 2, 0)), 'label-basement', this.basementGroup);
    }
  }

  toggleBasements() {
    this.basementsVisible = !this.basementsVisible;
    this.basementGroup.visible = this.basementsVisible;
    this.neighborhood.visible = !this.basementsVisible;
    this.container.classList.toggle('basement-mode', this.basementsVisible);
    for (const b of this.blocks.values())
      if (b.data.type !== 'BUILDING') b.group.visible = !this.basementsVisible;
    for (const m of this.grounds) {
      m.transparent = this.basementsVisible;
      m.opacity = this.basementsVisible ? 0.35 : 1;
      m.depthWrite = !this.basementsVisible;
      m.needsUpdate = true;
    }
    // Buildings turn translucent to show the underground levels
    for (const b of this.blocks.values()) {
      b.materials.forEach(m => {
        if (m.userData.opacity === undefined) m.userData.opacity = m.transparent ? m.opacity : 1;
        m.transparent = this.basementsVisible || m.userData.opacity < 1;
        m.opacity = this.basementsVisible ? Math.min(0.22, m.userData.opacity) : m.userData.opacity;
        m.depthWrite = !this.basementsVisible;
        m.needsUpdate = true;
      });
    }
    this.controls.maxPolarAngle = this.basementsVisible ? Math.PI * 0.62 : Math.PI * 0.47;
    if (this.basementsVisible) this.#fly(BASEMENTS_VIEW.goal.clone(), BASEMENTS_VIEW.camera.clone());
    else this.overview();
    return this.basementsVisible;
  }

  /* ================================================================ Interaction */
  select(id) {
    this.deselect();
    const b = this.blocks.get(id);
    if (!b) return;
    this.selected = id;
    b.materials.forEach(m => m.emissive.set('#16273d'));
    b.label.classList.add('current');

    const d = b.data;
    const destination = new THREE.Vector3(d.x, d.type === 'BUILDING' ? d.floors * FLOOR_HEIGHT * 0.4 : 0, d.z);
    const distance = Math.max(d.width, d.depth, 20) * 1.9;
    this.#fly(destination, destination.clone().add(new THREE.Vector3(distance * 0.75, distance * 0.8, distance)));
  }

  deselect() {
    if (!this.selected) return;
    const b = this.blocks.get(this.selected);
    b.materials.forEach(m => m.emissive.set('#000000'));
    b.label.classList.remove('current');
    this.selected = null;
  }

  /** Stops drawing the map while an interior is being walked (saves battery). */
  pauseRendering(pause) {
    this.renderer.setAnimationLoop(pause ? null : () => this.#picture());
  }

  overview() {
    this.#fly(OVERVIEW_VIEW.goal.clone(), OVERVIEW_VIEW.camera.clone());
  }

  #fly(goal, camera) {
    this.animation = {
      t: 0,
      fromTarget: this.controls.target.clone(), towardsTarget: goal,
      fromCamera: this.camera.position.clone(), towardsCamera: camera,
    };
  }

  #events() {
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let start = null;

    const touch = (ev) => {
      const r = this.renderer.domElement.getBoundingClientRect();
      pointer.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(pointer, this.camera);
      const objects = [...this.blocks.values()].map(b => b.group);
      if (this.basementsVisible) objects.push(this.basementGroup);
      const hit = raycaster.intersectObjects(objects, true).find(h => h.object.userData.id);
      return hit ? hit.object.userData.id : null;
    };

    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', ev => (start = { x: ev.clientX, y: ev.clientY }));
    canvas.addEventListener('pointerup', ev => {
      if (!start || Math.hypot(ev.clientX - start.x, ev.clientY - start.y) > 6) return;
      const id = touch(ev);
      if (id) this.onSelect?.(id);
    });
    canvas.addEventListener('pointermove', ev => {
      canvas.style.cursor = touch(ev) ? 'pointer' : 'grab';
    });

    window.addEventListener('resize', () => {
      const { clientWidth: w, clientHeight: h } = this.container;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
      this.labels.setSize(w, h);
    });
  }

  #picture() {
    if (this.animation) {
      const a = this.animation;
      a.t = Math.min(1, a.t + 0.022);
      const k = 1 - Math.pow(1 - a.t, 3);
      this.controls.target.lerpVectors(a.fromTarget, a.towardsTarget, k);
      this.camera.position.lerpVectors(a.fromCamera, a.towardsCamera, k);
      if (a.t === 1) this.animation = null;
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.labels.render(this.scene, this.camera);
  }
}

/* ==================================================================== Textures and vegetation */

/** Brick facade with a band of windows per floor (and glass bays for Block B). */
function textureFacade(widthMeters, floors, brickColor, withBays) {
  const ppm = 12;                                   // pixels per meter
  const w = Math.min(1024, Math.round(widthMeters * ppm));
  const h = Math.round(floors * FLOOR_HEIGHT * ppm);
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');

  // Brick
  g.fillStyle = brickColor;
  g.fillRect(0, 0, w, h);
  g.globalAlpha = 0.12;
  for (let y = 0; y < h; y += 4) {
    g.fillStyle = (y / 4) % 2 ? '#000' : '#fff';
    g.fillRect(0, y, w, 1);
  }
  g.globalAlpha = 1;

  const floorHeight = h / floors;
  for (let p = 0; p < floors; p++) {
    const y0 = h - (p + 1) * floorHeight;
    // Slab
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(0, y0 + floorHeight - 3, w, 3);
    // Windows: bigger on the first floor (glass facade)
    const height = p === 0 ? floorHeight * 0.62 : floorHeight * 0.42;
    const yv = y0 + (floorHeight - height) / 2;
    const module = 54;
    for (let x = 6; x < w - 20; x += module) {
      g.fillStyle = '#2c3d4f';
      g.fillRect(x, yv, module - 14, height);
      g.fillStyle = 'rgba(180,210,235,0.35)';
      g.fillRect(x + 2, yv + 2, (module - 14) / 2 - 2, height - 4);
    }
  }
  // Vertical glass bays (Block B)
  if (withBays) {
    const width = 44;
    for (let x = 40; x < w - width; x += 120) {
      g.fillStyle = '#354657';
      g.fillRect(x, floorHeight * 0.25, width, h - floorHeight * 1.1);
      g.strokeStyle = '#8796a3';
      g.lineWidth = 2;
      for (let y = floorHeight * 0.25; y < h - floorHeight; y += floorHeight / 2) {
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + width, y); g.stroke();
      }
      g.beginPath(); g.moveTo(x + width / 2, floorHeight * 0.25); g.lineTo(x + width / 2, h - floorHeight * 0.85); g.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

const trunkMat = new THREE.MeshStandardMaterial({ color: '#8a6a48' });
const leafMat = new THREE.MeshStandardMaterial({ color: '#4f8f45', side: THREE.DoubleSide });
const bushMat = new THREE.MeshStandardMaterial({ color: '#5f9a4f', flatShading: true });

function palm(x, z) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 5, 6), trunkMat);
  trunk.position.y = 2.5;
  trunk.castShadow = true;
  g.add(trunk);
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.35, 2.6, 4), leafMat);
    leaf.position.y = 5;
    leaf.rotation.set(Math.PI / 2.6, (i / 7) * Math.PI * 2, 0, 'YXZ');
    leaf.translateY(1.2);
    leaf.castShadow = true;
    g.add(leaf);
  }
  g.position.set(x, 0, z);
  return g;
}

function bush(x, z) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), bushMat);
  m.position.set(x, 0.8, z);
  m.scale.set(1.1, 0.8, 1.1);
  m.castShadow = true;
  return m;
}




/* ==================================================================== Textures of the pavilion and outdoors */

function canvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return [cv, cv.getContext('2d')];
}
function toTexture(cv, repeat) {
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}

function textureText(text, background, color, w = 256, h = 80) {
  const [cv, g] = canvas(w, h);
  g.fillStyle = background; g.fillRect(0, 0, w, h);
  g.fillStyle = color; g.font = `bold ${Math.round(h * 0.45)}px sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2);
  return toTexture(cv);
}

/** Herringbone brick of the entrance plaza. */
function textureHerringbone() {
  const [cv, g] = canvas(128, 128);
  g.fillStyle = '#b97a5c'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(80,40,25,0.35)'; g.lineWidth = 1.5;
  for (let i = -128; i < 256; i += 16) {
    for (let j = 0; j < 128; j += 32) {
      g.strokeRect(i + j / 2, j, 16, 8);
      g.strokeRect(i + j / 2 + 8, j + 8, 8, 16);
    }
  }
  return toTexture(cv, [6, 2]);
}

/** Ecological paver (concrete with grass) of ramps and plazas. */
function textureGrassPavers() {
  const [cv, g] = canvas(64, 64);
  g.fillStyle = '#9c968c'; g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#6d8f4e';
  for (let x = 4; x < 64; x += 16) for (let y = 4; y < 64; y += 16) g.fillRect(x, y, 8, 8);
  return toTexture(cv, [6, 8]);
}

/** Grey tile with diagonal joints of the path. */
function textureDiagonalTile(length) {
  const [cv, g] = canvas(128, 128);
  g.fillStyle = '#c9c5bf'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(90,90,90,0.35)'; g.lineWidth = 1.5;
  for (let i = -128; i < 256; i += 32) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 128, 128); g.stroke();
    g.beginPath(); g.moveTo(i + 128, 0); g.lineTo(i, 128); g.stroke();
  }
  return toTexture(cv, [1, Math.round(length / 5)]);
}

/**
 * Official logo of Universidad Cooperativa de Colombia (public/logo-ucc.png) on an
 * optional background. While the image loads the background is shown; then the texture is updated.
 */
function textureOfficialLogo(w, h, background, scale = 0.9) {
  const [cv, g] = canvas(w, h);
  const tex = toTexture(cv);
  const paint = (img) => {
    g.clearRect(0, 0, w, h);
    if (background) { g.fillStyle = background; g.fillRect(0, 0, w, h); }
    if (!img) return;
    const k = Math.min(w * scale / img.width, h * scale / img.height);
    const iw = img.width * k, ih = img.height * k;
    g.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
    tex.needsUpdate = true;
  };
  paint(null);
  const img = new Image();
  img.onload = () => paint(img);
  img.src = '/logo-ucc.png';
  return tex;
}

/** Showcase with institutional posters (left side of the entrance). */
function texturePosters() {
  const [cv, g] = canvas(512, 160);
  g.fillStyle = '#2d3f4f'; g.fillRect(0, 0, 512, 160);
  const colors = ['#f4d35e', '#5a8fb8', '#1e88a8', '#e9eef2'];
  for (let i = 0; i < 4; i++) {
    g.fillStyle = colors[i]; g.fillRect(12 + i * 125, 10, 112, 140);
    g.fillStyle = 'rgba(20,40,60,0.75)'; g.fillRect(22 + i * 125, 40, 90, 10); g.fillRect(22 + i * 125, 58, 70, 8);
  }
  return toTexture(cv);
}

/** Entrance shops: Comuna (loans) and Bonne Vie. */
function textureShops() {
  const [cv, g] = canvas(512, 160);
  g.fillStyle = '#e9edef'; g.fillRect(0, 0, 512, 160);
  g.strokeStyle = '#7d8790'; g.lineWidth = 4;
  for (let x = 0; x <= 512; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 160); g.stroke(); }
  g.fillStyle = '#2e8b57'; g.font = 'bold 18px sans-serif';
  ['Crédito', 'Estudiantil', 'Credi', 'Aportes'].forEach((t, i) => g.fillText(t, 14 + (i % 2) * 64, 60 + Math.floor(i / 2) * 50));
  g.fillStyle = '#3a4046'; g.fillRect(152, 30, 100, 130);
  g.fillStyle = '#8fd0c3'; g.font = 'bold 20px sans-serif'; g.fillText('comuna', 330, 90);
  g.fillStyle = '#2b2f33'; g.fillRect(400, 0, 112, 34);
  g.fillStyle = '#ffffff'; g.font = 'bold 18px serif'; g.fillText('BONNE VIE', 408, 24);
  return toTexture(cv);
}

/** Academic offer sign (undergraduate and graduate programs). */
function textureProgramsSign() {
  const [cv, g] = canvas(170, 210);
  g.fillStyle = '#f2f6f4'; g.fillRect(0, 0, 170, 210);
  g.fillStyle = '#1e88b8'; g.fillRect(10, 30, 70, 14);
  g.fillStyle = '#5cb85c'; g.fillRect(92, 30, 70, 14);
  g.fillStyle = '#ffffff'; g.font = 'bold 9px sans-serif';
  g.fillText('PREGRADOS', 18, 41); g.fillText('POSGRADOS', 100, 41);
  g.fillStyle = '#5b6770';
  for (let i = 0; i < 10; i++) { g.fillRect(12, 56 + i * 13, 50, 3); g.fillRect(94, 56 + i * 13, 54, 3); }
  g.fillStyle = '#2e8b57'; g.fillRect(0, 194, 170, 16);
  return toTexture(cv);
}

/* ==================================================================== Extra furniture and vegetation */

const cypressMat = new THREE.MeshStandardMaterial({ color: '#2f5b3b', roughness: 1, flatShading: true });
function cypress(x, z, height) {
  const g = new THREE.Group();
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.75, height, 8), cypressMat);
  crown.position.y = height / 2 + 0.4;
  crown.castShadow = true;
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.6, 6), trunkMat);
  base.position.y = 0.3;
  g.add(crown, base);
  g.position.set(x, 0, z);
  return g;
}

const flowerMat = [new THREE.MeshStandardMaterial({ color: '#e05c9a' }), new THREE.MeshStandardMaterial({ color: '#f0f0f0' })];
function flowers(x, z) {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 4), flowerMat[i % 2]);
    f.position.set(x + (i - 1) * 0.5, 0.45, z + (i % 2) * 0.6);
    g.add(f);
  }
  return g;
}

const postMat = new THREE.MeshStandardMaterial({ color: '#b8bfc4', metalness: 0.5 });
function post(x, z) {
  const g = new THREE.Group();
  const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 7, 8), postMat);
  p.position.y = 3.5;
  const arm = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 0.25), postMat);
  arm.position.set(0.8, 6.9, 0);
  g.add(p, arm);
  g.position.set(x, 0, z);
  return g;
}

const tableMat = new THREE.MeshStandardMaterial({ color: '#4a4f54' });
const chairMat = new THREE.MeshStandardMaterial({ color: '#eceeee' });
function table(x, z, withUmbrella) {
  const g = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 1.2), withUmbrella ? chairMat : tableMat);
  board.position.y = 0.75;
  const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.75, 6), tableMat);
  leg.position.y = 0.37;
  g.add(board, leg);
  for (const [dx, dz] of [[0.9, 0], [-0.9, 0], [0, 0.9], [0, -0.9]]) {
    const chair = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.9, 0.5), withUmbrella ? chairMat : tableMat);
    chair.position.set(dx, 0.45, dz);
    g.add(chair);
  }
  if (withUmbrella) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.6, 6), tableMat);
    pole.position.y = 1.3;
    const canvasCover = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.6, 8), new THREE.MeshStandardMaterial({ color: '#8f8a85' }));
    canvasCover.position.y = 2.6;
    g.add(pole, canvasCover);
  }
  g.position.set(x, 0, z);
  return g;
}

const bikeMat = new THREE.MeshStandardMaterial({ color: '#f4f4f4' });
const wheelMat = new THREE.MeshStandardMaterial({ color: '#222222' });
function bicycle(x, z) {
  const g = new THREE.Group();
  for (const dz of [-0.55, 0.55]) {
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.04, 6, 16), wheelMat);
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(0, 0.35, dz);
    g.add(wheel);
  }
  const picture = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 1.1), bikeMat);
  picture.position.y = 0.6;
  const basket = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.25), bikeMat);
  basket.position.set(0, 0.85, 0.6);
  g.add(picture, basket);
  g.position.set(x, 0, z);
  return g;
}
