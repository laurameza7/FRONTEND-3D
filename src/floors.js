import * as THREE from 'three';
import { HEIGHT, mat, canvas, texture } from './walkthrough.js';
import {
  lockers, bench, chair, desk, fileCabinet, plant, bins, noticeBoard, extinguisher,
  woodTable, shelf, stool, box, cylinder, memo, textureUccLogo, textureBoard,
} from './floorPlans.js';

/*
 * Generator of "typical" floors of blocks A and B, based on what is seen in the videos:
 * a central hallway and, on each side, classrooms, offices, laboratories, restrooms and stairs.
 * Each floor is described with data (what is on each side and in which segment) and built here:
 * walls, doors, signs, furniture, stairs between floors and the destinations of the "Ir a…" menu.
 *
 * Local coordinates: the hallway runs along z (from -L/2 to L/2), centered at x = 0.
 * side 'left' = negative x, 'right' = positive x. yaw 0 looks towards -z.
 */

const PI = Math.PI, RIGHT = -PI / 2, LEFT = PI / 2;

/* ======================================================================== Styles of each block */
export const STYLES = {
  // Block B: exposed brick in the hallways, wine-red doors, bright light grey floor, blue chairs
  B: { floor: 'terrazzo', wall: 'white', hallway: 'brick', door: 'redDoor', lamps: 'tube',
       pipes: true, bench: 'blue', ceiling: 'ceiling', strip: false, partitions: 'wall' },
  // Upper floors of B: beige granite and wooden benches
  BUpper: { floor: 'granite', wall: 'white', hallway: 'brick', door: 'redDoor', lamps: 'tube',
           pipes: true, bench: 'wood', ceiling: 'ceiling', strip: false, partitions: 'wall' },
  // Block A: white walls with a wooden band, exposed grid concrete ceiling with yellow pipes,
  // orange wooden doors and offices with frosted glass partitions
  A: { floor: 'beige', wall: 'whiteBand', hallway: 'whiteBand', door: 'orangeDoor', lamps: 'tube',
       pipes: 'yellow', bench: 'tandem', ceiling: 'grid', strip: true, partitions: 'glass' },
};

/* ======================================================================== API */
/**
 * Creates a level ready for INTERIORS from its description.
 *  def = { id, name, short, style, W, L, P, rooms: [...], ends: {north, south}, extra(k) }
 *  room = { side:'left'|'right', z0, z1, type, name, sign?, places?, keys?, depth?, door? }
 *  type 'stairs' = core with one staircase going up and another going down (options up/down = floor id)
 */
export function level(def) {
  const d = { P: 3, ends: {}, ...def };
  return {
    id: d.id, name: d.name, short: d.short, style: { ...STYLES[d.style ?? 'B'], ...(d.extraStyle ?? {}) },
    destinations: destinationsOf(d),
    build: (k) => build(k, d),
  };
}

const slug = (s) => String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const mark = (side) => (side === 'left' ? -1 : 1);

/** Geometry of a room: hallway edge (xi), back (xe) and door. */
function geo(d, s) {
  const sg = mark(s.side), xi = sg * d.P / 2, xe = sg * Math.min(d.W / 2, d.P / 2 + (s.depth ?? d.W / 2));
  const pz = s.door ?? (s.z1 - Math.min(1.4, (s.z1 - s.z0) / 2));   // door near the +z end
  return { sg, xi, xe, pz, x0: Math.min(xi, xe), x1: Math.max(xi, xe), cx: (xi + xe) / 2, cz: (s.z0 + s.z1) / 2,
           length: s.z1 - s.z0, depth: Math.abs(xe - xi) };
}

function destinationsOf(d) {
  const list = [];
  const stairSet = d.rooms.filter(s => s.type === 'stairs');
  stairSet.forEach((s, i) => {
    const g = geo(d, s);
    list.push({ id: 'stairs' + i, name: stairSet.length > 1 ? `Escaleras ${i + 1}` : 'Escaleras', x: g.sg * 0.2, z: g.cz, yaw: g.sg > 0 ? RIGHT : LEFT, hidden: i > 0 });
  });
  for (const s of d.rooms) {
    if (s.type === 'stairs' || s.type === 'wall' || s.noDestination) continue;
    const g = geo(d, s);
    const isOpen = s.type === 'open' || s.isOpen;
    const x = isOpen ? g.xi + g.sg * Math.min(1.8, g.depth / 2) : g.xi + g.sg * 1.0;
    list.push({
      id: s.id ?? slug(s.name), name: s.name, x, z: isOpen ? g.cz : g.pz, yaw: g.sg > 0 ? RIGHT : LEFT,
      places: s.places, keys: s.keys, note: s.note, approximate: s.approximate,
    });
  }
  for (const e of d.extraDestinations ?? []) list.push(e);
  return list;
}

/* ======================================================================== Construction */
function build(k, d) {
  const { W, L, P } = d;
  const sty = k.style;
  k.setBounds(-W / 2 - 0.5, -L / 2 - 0.5, W / 2 + 0.5, L / 2 + 0.5);
  // Hallway with its own floor (burgundy on some floors of A) and rooms with the floor of the block
  k.floor(-P / 2, -L / 2, P / 2, L / 2, d.hallwayFloor);
  k.floor(-W / 2, -L / 2, -P / 2, L / 2);
  k.floor(P / 2, -L / 2, W / 2, L / 2);

  // Outer walls (the rooms add their own windows)
  const endSide = (z, type, rot) => {
    if (type === 'open') return;
    if (type === 'bigWindow') k.glassWall(-P / 2 - 0.2, z, P / 2 + 0.2, z, {});
    else if (type?.connection) {
      k.wall(-W / 2, z, W / 2, z, { mat: sty.hallway, openings: [[W / 2 - 0.9, W / 2 + 0.9]] });
      k.sign([`Paso al ${type.connection}`], 0, 2.55, z - Math.sign(z) * 0.1, rot, 'ucc');
      k.door(-0.45, z, rot, { glass: true, width: 0.9, isOpen: false });
      k.door(0.45, z, rot + PI, { glass: true, width: 0.9, isOpen: false });
      k.portal(-0.9, z - Math.sign(z) * 0.6 - 0.3, 0.9, z - Math.sign(z) * 0.6 + 0.3, type.level, type.arrival, type.building);
      return;
    }
    else k.wall(-W / 2, z, W / 2, z, { mat: sty.hallway, windows: type === 'window' ? [[W / 2 - 1.2, W / 2 + 1.2]] : [] });
  };
  endSide(-L / 2, d.ends.north ?? 'window', 0);
  endSide(L / 2, d.ends.south ?? 'window', PI);
  // Side facades: each room adds its segment (with windows); here only the free segments
  for (const side of ['left', 'right']) {
    const sg = mark(side);
    const taken = d.rooms.filter(s => s.side === side && Math.abs(geo(d, s).xe) >= W / 2 - 0.01)
      .map(s => [s.z0, s.z1]).sort((a, b) => a[0] - b[0]);
    let z = -L / 2;
    for (const [a, b] of [...taken, [L / 2, L / 2]]) {
      if (a - z > 0.05) k.wall(sg * W / 2, z, sg * W / 2, a, { mat: 'white', windows: a - z > 2 ? [[0.6, a - z - 0.6]] : [] });
      z = Math.max(z, b);
    }
  }

  // Segments of the hallway edge without a room → wall with brick/band
  for (const side of ['left', 'right']) {
    const sg = mark(side);
    const taken = d.rooms.filter(s => s.side === side).map(s => [s.z0, s.z1]).sort((a, b) => a[0] - b[0]);
    let z = -L / 2;
    for (const [a, b] of [...taken, [L / 2, L / 2]]) {
      if (a - z > 0.2) k.wall(sg * P / 2, z, sg * P / 2, a, { mat: sty.hallway });
      z = Math.max(z, b);
    }
  }

  for (const s of d.rooms) room(k, d, s);
  hallway(k, d);
  d.extra?.(k);
}

/** Hallway: lamps, pipes, benches, bins, notice boards, extinguishers and plants. */
function hallway(k, d) {
  const { L, P } = d, sty = k.style;
  k.lamps(0, -L / 2 + 1.5, 0, L / 2 - 1.5, { axis: 'z', passage: 3.2 });
  if (sty.pipes) {
    k.pipes(P / 2 - 0.25, -L / 2, P / 2 - 0.25, L / 2, HEIGHT - 0.15, 2);
    if (sty.pipes === 'yellow') {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, L, 8), mat('yellowTube'));
      t.rotation.x = PI / 2; t.position.set(-P / 2 + 0.3, HEIGHT - 0.25, 0);
      k.add(t);
    }
  }
  // Hallway furniture on the free wall segments (no doors)
  let i = 0;
  for (const side of ['left', 'right']) {
    const sg = mark(side);
    const openings = d.rooms.filter(s => s.side === side && s.type !== 'wall').map(s => {
      if (s.type === 'stairs' || s.type === 'open' || s.isOpen) return [s.z0, s.z1];
      const g = geo(d, s); return [g.pz - 0.9, g.pz + 0.9];
    });
    for (let z = -L / 2 + 2.2; z < L / 2 - 2; z += 3.3) {
      if (openings.some(([a, b]) => z > a - 1.4 && z < b + 1.4)) continue;
      const x = sg * (P / 2 - 0.32), rot = sg > 0 ? RIGHT : LEFT;   // with its back to the wall
      const type = (i++ + (sg > 0 ? 1 : 0)) % 4;
      if (type === 0) k.placeObject(hallBench(sty.bench), x - sg * 0.02, z, rot);
      else if (type === 1) { k.placeObject(bins(['#2e7d32', '#9e9e9e', '#1565c0']), x, z, rot); k.placeObject(extinguisher(), sg * (P / 2 - 0.1), z + 0.9, rot, false); }
      else if (type === 2) { k.placeObject(noticeBoard(1.6, 1.0, '#2e6b4f', 'notices'), sg * (P / 2 - 0.1), z, rot, false, 1.0); k.placeObject(hallBench(sty.bench), x, z, rot); }
      else k.placeObject(plant(), x, z, rot);
    }
  }
}

/* ---------------------------------------------------------------- rooms */
function room(k, d, s) {
  const sty = k.style;
  const g = geo(d, s);
  const { sg, xi, xe, pz } = g;
  if (s.type === 'wall') return;

  // Wall towards the hallway, with the door
  if (s.type === 'stairs' || s.type === 'open' || s.isOpen) {
    // no wall: you walk straight in
  } else if (sty.partitions === 'glass' && ['office', 'lab', 'chemLab', 'innovation', 'computers', 'teachers', 'preclinic', 'simulation', 'multipurpose'].includes(s.type)) {
    k.glassWall(xi, s.z0, xi, s.z1, { openings: [[pz - s.z0 - 0.5, pz - s.z0 + 0.5]], frosted: false, strip: true });
    k.door(xi, pz - 0.5, sg > 0 ? PI : 0, { color: sty.door, width: 1.0 });
  } else {
    k.wall(xi, s.z0, xi, s.z1, { mat: sty.hallway, openings: [[pz - s.z0 - 0.5, pz - s.z0 + 0.5]] });
    k.door(xi, pz - 0.5, sg > 0 ? PI : 0, { color: sty.door, width: 1.0 });
  }
  // Partitions with the neighboring rooms
  if (s.type !== 'open') {
    k.wall(xi, s.z0, xe, s.z0, { mat: s.type === 'stairs' ? sty.hallway : sty.wall });
    k.wall(xi, s.z1, xe, s.z1, { mat: s.type === 'stairs' ? sty.hallway : sty.wall });
  }
  // Windows to the outside
  if (Math.abs(xe) >= d.W / 2 - 0.01) {
    const v = s.windows ?? (s.type === 'stairs' || s.type === 'restrooms' ? 'wall' : 'window');
    if (v === 'bigWindow') k.glassWall(xe, s.z0, xe, s.z1, {});
    else if (v === 'wall' || g.length <= 2) k.wall(xe, s.z0, xe, s.z1, { mat: s.type === 'stairs' ? sty.hallway : 'white' });
    else k.wall(xe, s.z0, xe, s.z1, { mat: 'white', windows: [[0.5, g.length - 0.5]] });
  }
  // Turquoise sign next to the door (like the ones on campus)
  if (s.sign !== false && s.type !== 'open' && s.type !== 'stairs') {
    const text = s.sign ?? (s.number ? [s.name.replace(/ \d+$/, ''), s.number] : split(s.name));
    k.sign(text, xi - sg * 0.1, 1.75, pz + 0.95, sg > 0 ? RIGHT : LEFT, 'floor');
  } else if (s.type === 'open' && s.sign !== false) {
    k.label(s.name, g.cx, 2.4, g.cz);
  }
  // Ceiling: its own lamps
  if (s.type !== 'stairs') k.lamps(g.x0 + 1.2, s.z0 + 1.2, g.x1 - 1.2, s.z1 - 1.2, { axis: 'z', passage: 2.6, type: sty.ceiling === 'grid' ? 'tube' : 'panel' });

  (s.furniture ?? FURNITURE[s.type] ?? FURNITURE.office)(k, g, s, d);
  k.zone(s.id ?? slug(s.name), g.x0, s.z0, g.x1, s.z1);
}

function split(name) {
  const p = name.split(' ');
  if (name.length < 18 || p.length < 3) return [name];
  const m = Math.ceil(p.length / 2);
  return [p.slice(0, m).join(' '), p.slice(m).join(' ')];
}

/* ======================================================================== Furniture per room type */
const FURNITURE = {
  /** Classroom: turquoise tablet-arm chairs, desk, board and projector. */
  classroom(k, g, s) {
    const { sg, xi, xe } = g;
    const frontZ = s.z0 + 0.5;                       // the board on the -z wall
    k.placeObject(whiteboard(Math.min(3.6, g.depth - 2)), g.cx, s.z0 + 0.1, 0, false, 0.9);
    k.placeObject(teacherDesk(), g.cx + sg * (g.depth / 2 - 1.6), frontZ + 1.0, 0);
    k.placeObject(ceilingProjector(), g.cx, s.z0 + g.length / 2, 0, false, HEIGHT - 0.5);
    const rowsZ = [];
    for (let z = frontZ + 2.2; z < s.z1 - 0.9; z += 0.95) rowsZ.push(z);
    // Rows of chairs from the window, leaving a 1.6 m aisle next to the door
    const far = xe - sg * 0.8, near = xi + sg * 1.7;
    const xa = Math.min(far, near), xb = Math.max(far, near);
    rowsZ.forEach((z, fi) => {
      for (let x = xa + (fi % 2) * 0.05; x <= xb; x += 0.78)
        k.placeObject(tabletChair(s.chair ?? '#1aa0a8'), x, z, 0, false);
    });
    if (rowsZ.length && xb > xa) k.obstacle(xa - 0.3, rowsZ[0] - 0.35, xb + 0.35, rowsZ.at(-1) + 0.35);
    curtains(k, g, s);
  },

  /** Office: workstations with computers, file cabinets and waiting chairs. */
  office(k, g, s) {
    const n = Math.max(1, Math.min(4, Math.floor(g.length / 2.4)));
    for (let i = 0; i < n; i++) {
      const z = s.z0 + 1.4 + i * ((g.length - 2.2) / Math.max(1, n - 1 || 1));
      k.placeObject(desk(), g.xe - g.sg * 1.2, Math.min(z, s.z1 - 1.2), g.sg > 0 ? RIGHT : LEFT);
    }
    k.placeObject(fileCabinet(), g.xi + g.sg * 0.5, s.z0 + 0.4, 0);
    if (g.length > 4) k.placeObject(fileCabinet(), g.xi + g.sg * 1.1, s.z0 + 0.4, 0);
    k.placeObject(plant(), g.xe - g.sg * 0.5, s.z1 - 0.5, 0);
    if (s.logo) k.image(textureUccLogo(), 1.2, 1.2, g.cx, 1.7, s.z0 + 0.1, 0);
  },

  /** Dean's office / faculty: reception, offices and waiting room. */
  faculty(k, g, s) {
    FURNITURE.office(k, g, s);
    k.placeObject(serviceCounter(2.2), g.xi + g.sg * 1.8, g.pz - 1.8, g.sg > 0 ? RIGHT : LEFT);
    k.placeObject(hallBench('blue', 3), g.xi + g.sg * 0.45, s.z0 + 2.6, g.sg > 0 ? LEFT : RIGHT);
    k.image(textureUccLogo(), 1.1, 1.1, g.cx, 1.8, s.z0 + 0.1, 0);
  },

  /** Teachers' room: long table, chairs, lockers and cubbies. */
  teachers(k, g, s) {
    const length = Math.min(g.length - 2.2, 5);
    k.placeObject(woodTable(1.2, length, '#c9a571'), g.cx, g.cz, 0);
    for (let z = g.cz - length / 2 + 0.5; z < g.cz + length / 2; z += 0.8)
      for (const sx of [-1, 1]) k.placeObject(chair('#2b2e33'), g.cx + sx * 0.85, z, sx > 0 ? RIGHT : LEFT, false);
    k.placeObject(lockers({ cols: 4, rows: 4, type: 'metal' }), g.xe - g.sg * 0.3, s.z0 + 1.2, g.sg > 0 ? LEFT : RIGHT);
    k.placeObject(desk(), g.xe - g.sg * 1.1, s.z1 - 1.2, g.sg > 0 ? RIGHT : LEFT);
  },

  /** Computer room: long tables in rows with computers. */
  computers(k, g, s) {
    const rows = [];
    for (let z = s.z0 + 1.6; z < s.z1 - 1.2; z += 1.7) rows.push(z);
    const width = g.depth - 2.2;
    for (const z of rows) {
      k.placeObject(computerTable(width, Math.max(2, Math.floor(width / 0.9))), g.cx + g.sg * 0.3, z, 0);
      for (let x = -width / 2 + 0.45; x < width / 2; x += 0.9) k.placeObject(chair('#1f2a36'), g.cx + g.sg * 0.3 + x, z + 0.6, PI, false);
    }
    k.placeObject(whiteboard(2.6), g.cx, s.z0 + 0.1, 0, false, 0.9);
    k.placeObject(tv(), g.cx + g.sg * 2.2, s.z0 + 0.15, 0, false, 1.4);
  },

  /** Generic laboratory: white counters with sinks and stools. */
  lab(k, g, s) {
    const rows = [];
    for (let z = s.z0 + 1.8; z < s.z1 - 1.5; z += 2.4) rows.push(z);
    const width = Math.min(g.depth - 2.4, 6);
    for (const z of rows) {
      k.placeObject(labCounter(width), g.cx + g.sg * 0.4, z, 0);
      for (let x = -width / 2 + 0.4; x < width / 2; x += 0.8)
        for (const dz of [-0.75, 0.75]) k.placeObject(stool(), g.cx + g.sg * 0.4 + x, z + dz, 0, false);
    }
    k.placeObject(labCabinet(), g.xe - g.sg * 0.35, s.z0 + 1.2, g.sg > 0 ? LEFT : RIGHT);
    k.placeObject(labSink(), g.xe - g.sg * 0.35, s.z1 - 1.0, g.sg > 0 ? LEFT : RIGHT);
    k.placeObject(whiteboard(2.4), g.cx, s.z0 + 0.1, 0, false, 0.9);
  },

  /** Operations laboratory: steel counters with long sinks under the big window. */
  operations(k, g, s) {
    k.placeObject(longKitchenSink(g.length - 1.6), g.xe - g.sg * 0.45, g.cz, g.sg > 0 ? LEFT : RIGHT);
    k.placeObject(labCabinet(), g.xi + g.sg * 0.5, s.z0 + 0.8, g.sg > 0 ? RIGHT : LEFT);
    for (let z = s.z0 + 2; z < s.z1 - 1.5; z += 2.6) k.placeObject(longSteelTable(2.4), g.cx, z, 0);
  },

  /** Innovation, Prototyping and Entrepreneurship Laboratory: white tables and 3D printers. */
  innovation(k, g, s) {
    for (let z = s.z0 + 1.6; z < s.z1 - 1.6; z += 2.2) {
      k.placeObject(whiteTable(2.4, 1.0), g.cx - g.sg * 0.6, z, 0);
      for (const dx of [-0.7, 0.7]) k.placeObject(chair('#26292c'), g.cx - g.sg * 0.6 + dx, z + 0.75, PI, false);
    }
    k.placeObject(whiteTable(g.length - 2, 0.75), g.xe - g.sg * 0.5, g.cz, g.sg > 0 ? LEFT : RIGHT);
    for (let z = s.z0 + 1.6; z < s.z1 - 1; z += 1.2) k.placeObject(printer3D(), g.xe - g.sg * 0.5, z, 0, false, 0.78);
    k.placeObject(redPanel(), g.cx + g.sg * 1.5, s.z1 - 0.15, PI, false);
  },

  /** Dental pre-clinic: counters with simulator heads. */
  preclinic(k, g, s) {
    for (let z = s.z0 + 1.6; z < s.z1 - 1.4; z += 2.2) {
      k.placeObject(labCounter(g.depth - 2.6, false), g.cx + g.sg * 0.4, z, 0);
      for (let x = -(g.depth - 2.6) / 2 + 0.5; x < (g.depth - 2.6) / 2; x += 0.9) {
        k.placeObject(simulatorHead(), g.cx + g.sg * 0.4 + x, z - 0.25, 0, false, 0.92);
        k.placeObject(stool(), g.cx + g.sg * 0.4 + x, z + 0.7, 0, false);
      }
    }
    k.placeObject(whiteboard(2.6), g.cx, s.z0 + 0.1, 0, false, 0.9);
    k.placeObject(tv(), g.cx + g.sg * 2.2, s.z0 + 0.15, 0, false, 1.4);
  },

  /** Clinical simulation: stretchers with mannequins. */
  simulation(k, g, s) {
    for (let z = s.z0 + 1.6; z < s.z1 - 1.2; z += 2.4) {
      k.placeObject(stretcher(), g.xe - g.sg * 1.3, z, g.sg > 0 ? LEFT : RIGHT);
      k.placeObject(clinicCurtain(2.2), g.xe - g.sg * 1.3, z + 1.2, 0, false);
    }
    k.placeObject(labCabinet(), g.xi + g.sg * 0.5, s.z0 + 0.8, g.sg > 0 ? RIGHT : LEFT);
  },

  /** Multipurpose laboratory: round white tables. */
  multipurpose(k, g, s) {
    for (let z = s.z0 + 1.8; z < s.z1 - 1.4; z += 2.3)
      for (let x = Math.min(g.xi, g.xe) + 2.4; x < Math.max(g.xi, g.xe) - 1.6; x += 2.4) {
        k.placeObject(roundTable(0.6, '#f2f2f0'), x, z, 0);
        around(k, x, z, 0.85, () => chair('#3a4048'));
      }
    k.placeObject(whiteboard(2.6), g.cx, s.z0 + 0.1, 0, false, 0.9);
  },

  /** Auditorium: stage, screen and rows of black seats. */
  auditorium(k, g, s) {
    const tz = s.z0 + 1.4;
    k.placeObject(platform(g.depth - 1.2, 2.2), g.cx, tz, 0);
    k.placeObject(screen(Math.min(5, g.depth - 3)), g.cx, s.z0 + 0.12, 0, false, 1.0);
    k.placeObject(lectern(), g.cx + g.sg * (g.depth / 2 - 1.6), tz + 0.4, 0, false, 0.3);
    if (s.wallColor) k.box(0.05, HEIGHT, g.length, s.wallColor, g.xe - g.sg * 0.12, HEIGHT / 2, g.cz);
    const rows = [];
    for (let z = tz + 2.2; z < s.z1 - 1.0; z += 0.95) rows.push(z);
    // free 1.6 m aisle next to the entrance
    const x0 = g.sg > 0 ? g.xi + 1.7 : g.xe + 0.9, x1 = g.sg > 0 ? g.xe - 0.9 : g.xi - 1.7;
    for (const z of rows)
      for (let x = x0; x < x1; x += 0.6) {
        if (Math.abs(x - g.cx) < 0.5) continue;                  // central aisle
        k.placeObject(auditoriumSeat(), x, z, 0, false);
      }
    if (rows.length) {
      k.obstacle(x0 - 0.3, rows[0] - 0.3, g.cx - 0.5, rows.at(-1) + 0.3);
      k.obstacle(g.cx + 0.5, rows[0] - 0.3, x1 + 0.3, rows.at(-1) + 0.3);
    }
    curtains(k, g, s, '#2f2a28');
  },

  /** Hearing rooms (Law): wooden bench, tables of the parties and audience. */
  hearings(k, g, s) {
    k.placeObject(stage(Math.min(3.6, g.depth - 2)), g.cx, s.z0 + 1.0, 0);
    k.image(textureUccLogo(), 0.9, 0.9, g.cx, 2.1, s.z0 + 0.1, 0);
    for (const dx of [-1.3, 1.3]) {
      k.placeObject(woodTable(1.6, 0.7, '#7b4a2a'), g.cx + dx, s.z0 + 3.2, 0);
      k.placeObject(chair('#3a2a20'), g.cx + dx - 0.35, s.z0 + 3.8, PI, false);
      k.placeObject(chair('#3a2a20'), g.cx + dx + 0.35, s.z0 + 3.8, PI, false);
    }
    for (let z = s.z0 + 5; z < s.z1 - 1; z += 1.0) k.placeObject(hallBench('wood', 4), g.cx, z, PI);
  },

  /** Restrooms: sinks with mirror and cubicles. */
  restrooms(k, g, s) {
    const n = Math.max(2, Math.floor((g.length - 1.2) / 1.0));
    for (let i = 0; i < n; i++) k.placeObject(cubicle(), g.xe - g.sg * 0.75, s.z0 + 0.7 + i * 1.0, g.sg > 0 ? LEFT : RIGHT);
    k.placeObject(doubleSink(), g.xi + g.sg * 0.45, s.z0 + 1.2, g.sg > 0 ? RIGHT : LEFT);
    const women = /mujer/i.test(s.name);
    k.sign([women ? 'Baño mujeres' : 'Baño hombres'], g.xi - g.sg * 0.1, 2.35, g.pz + 0.95, g.sg > 0 ? RIGHT : LEFT, 'restrooms');
  },

  /** Stair core: one goes up and the other goes down, each one leads to the next floor. */
  stairs(k, g, s, d) {
    const idx = d.rooms.filter(x => x.type === 'stairs').indexOf(s);
    const xa = g.xi + g.sg * 0.35, width = Math.min(1.5, (g.depth - 1.0) / 2);
    const flow = [];
    if (s.up != null) flow.push(['up', s.up]);
    if (s.down != null) flow.push(['down', s.down]);
    flow.forEach(([dir, destination], i) => {
      const xA = xa + g.sg * (i * (width + 0.25)), xB = xA + g.sg * width;
      const x0 = Math.min(xA, xB), x1 = Math.max(xA, xB);
      const zIni = s.z1 - 1.0, zFin = zIni - 5.4;
      k.staircase(x0, x1, zIni, zFin, dir, { railings: [true, true] });
      k.portal(x0, zFin + 0.2, x1, zFin + 1.6, destination, 'stairs' + idx, s.building);
      k.sign([dir === 'up' ? 'Sube' : 'Baja', `al ${levelName(destination)}`], (x0 + x1) / 2, 2.55, zIni + 0.6, 0, 'floor');
    });
    k.placeObject(plant(), g.xe - g.sg * 0.45, s.z1 - 0.45, 0);
  },

  /** Open area (no wall towards the hallway): puffs, tables, lockers... */
  open(k, g, s) {
    (ZONES[s.zone] ?? (() => {}))(k, g, s);
  },
};

/** Contents of the open areas. */
const ZONES = {
  lockers(k, g, s) {
    for (let z = s.z0 + 0.9; z < s.z1 - 0.8; z += 1.7) k.placeObject(lockers({ cols: 4, rows: 4 }), g.xe - g.sg * 0.3, z, g.sg > 0 ? LEFT : RIGHT);
  },
  waiting(k, g, s) {
    for (let z = s.z0 + 1.2; z < s.z1 - 1; z += 1.4) k.placeObject(hallBench(k.style.bench, 4), g.cx, z, PI);
  },
  puffs(k, g, s) {
    for (let i = 0; i < 9; i++) k.placeObject(puff(), g.cx + ((i % 3) - 1) * 1.3 + (i % 2) * 0.2, s.z0 + 1.2 + Math.floor(i / 3) * 1.5, i, false);
  },
  pingpong(k, g, s) {
    for (let z = s.z0 + 2; z < s.z1 - 1.6; z += 3.2) k.placeObject(pingPongTable(), g.cx, z, 0);
    k.placeObject(roundTable(0.5, '#f0f0ee'), g.xe - g.sg * 1, s.z1 - 1, 0);
  },
  gym(k, g, s) {
    for (let z = s.z0 + 1.2; z < s.z1 - 1; z += 1.2) k.placeObject(treadmill(), g.xe - g.sg * 1.2, z, g.sg > 0 ? LEFT : RIGHT);
    for (let z = s.z0 + 1.2; z < s.z1 - 1; z += 1.1) k.placeObject(exerciseBike(), g.cx - g.sg * 0.6, z, g.sg > 0 ? LEFT : RIGHT);
    k.box(g.x1 - g.x0 - 0.2, 0.02, s.z1 - s.z0 - 0.2, '#2b2e31', g.cx, 0.01, g.cz);
  },
  tables(k, g, s) {
    for (let z = s.z0 + 1.5; z < s.z1 - 1; z += 2.2)
      for (let x = g.x0 + 1.4; x < g.x1 - 1; x += 2.4) {
        k.placeObject(roundTable(0.55, '#c9a26b'), x, z, 0);
        around(k, x, z, 0.8, () => chair('#9aa5ae', 'plastic'));
      }
  },
  balcony(k, g, s) {
    k.placeObject(railing(g.length), g.xe - g.sg * 0.1, g.cz, LEFT, true);
    k.placeObject(plant(), g.xi + g.sg * 0.5, s.z0 + 0.5, 0);
  },
  backing(k, g, s) {
    k.image(textureBacking(), g.length - 0.4, 2.6, g.xe - g.sg * 0.1, 1.4, g.cz, g.sg > 0 ? LEFT : RIGHT);
    k.placeObject(woodTable(1.4, 0.6, '#c9a571'), g.cx, g.cz, 0);
  },
};

/** Four chairs facing the center of a table. */
function around(k, x, z, r, create) {
  for (let a = 0; a < 4; a++) {
    const ang = a * PI / 2, dx = Math.cos(ang) * r, dz = Math.sin(ang) * r;
    k.placeObject(create(), x + dx, z + dz, Math.atan2(-dx, -dz), false);
  }
}

/* ---------------------------------------------------------------- floor names */
const NAMES = { '-2': 'Sótano 2', '-1': 'Piso 0', 0: 'Piso 0' };
export function levelName(id) { return NAMES[id] ?? `Piso ${id}`; }

/* ======================================================================== New furniture */
function tabletChair(color) {
  return memo('chair:' + color, () => {
    const g = new THREE.Group();
    box(g, 0.44, 0.05, 0.42, color, 0, 0.45, 0);                      // seat
    box(g, 0.44, 0.38, 0.05, color, 0, 0.72, 0.2);                    // backrest
    box(g, 0.3, 0.03, 0.42, '#d9c7a4', 0.27, 0.72, -0.05);            // tablet arm
    for (const [x, z] of [[-0.19, -0.17], [0.19, -0.17], [-0.19, 0.18], [0.19, 0.18]]) box(g, 0.025, 0.45, 0.025, 'frame', x, 0.225, z);
    box(g, 0.025, 0.28, 0.025, 'frame', 0.36, 0.58, -0.15);
    return g;
  }).clone();
}
function teacherDesk() {
  const g = new THREE.Group();
  box(g, 1.4, 0.05, 0.7, '#b98f5e', 0, 0.75, 0);
  box(g, 1.36, 0.6, 0.03, '#a07a4d', 0, 0.45, 0.3);
  for (const x of [-0.66, 0.66]) box(g, 0.04, 0.73, 0.66, 'frame', x, 0.37, 0);
  box(g, 0.34, 0.22, 0.02, 'black', -0.2, 0.92, -0.05);
  g.add(chair('#2b2e33'));
  g.children.at(-1).position.set(0, 0, -0.6);
  return g;
}
function whiteboard(w) {
  const g = new THREE.Group();
  box(g, w, 1.2, 0.03, '#fbfbfb', 0, 0.6, 0.02);
  box(g, w + 0.06, 0.04, 0.05, 'steel', 0, 1.22, 0.02);
  box(g, w + 0.06, 0.04, 0.05, 'steel', 0, -0.02, 0.02);
  box(g, w * 0.6, 0.03, 0.08, 'steel', 0, 0.0, 0.06);
  return g;
}
function ceilingProjector() {
  const g = new THREE.Group();
  box(g, 0.04, 0.4, 0.04, 'black', 0, 0.2, 0);
  box(g, 0.38, 0.12, 0.3, '#e9ebec', 0, -0.03, 0);
  cylinder(g, 0.04, 0.04, 'black', 0, -0.03, -0.16, 10).rotation.x = PI / 2;
  return g;
}
function tv() {
  const g = new THREE.Group();
  box(g, 1.4, 0.8, 0.06, '#121416', 0, 0, 0);
  box(g, 1.32, 0.72, 0.01, '#1e2a36', 0, 0, 0.035);
  return g;
}
function serviceCounter(w) {
  const g = new THREE.Group();
  box(g, w, 1.05, 0.6, '#d8cdb8', 0, 0.52, 0);
  box(g, w + 0.1, 0.04, 0.7, '#b98f5e', 0, 1.07, 0);
  box(g, 0.4, 0.28, 0.03, 'black', 0.4, 1.25, 0.1);
  return g;
}
function hallBench(type = 'blue', n = 3) {
  if (type === 'wood') {
    const g = new THREE.Group();
    const w = n * 0.5;
    box(g, w, 0.05, 0.42, '#a8693a', 0, 0.44, 0);
    box(g, w, 0.32, 0.04, '#a8693a', 0, 0.68, 0.2);
    for (const x of [-w / 2 + 0.08, w / 2 - 0.08]) { box(g, 0.06, 0.44, 0.38, '#7b4a28', x, 0.22, 0); }
    return g;
  }
  return bench(n, type === 'tandem' ? '#2c7f86' : '#2f55c8');
}
function computerTable(w, n) {
  const g = new THREE.Group();
  box(g, w, 0.04, 0.75, '#e2d4b8', 0, 0.74, 0);
  box(g, w, 0.55, 0.03, '#9aa2a8', 0, 0.45, -0.35);
  for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) box(g, 0.05, 0.72, 0.7, 'frame', x, 0.36, 0);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (i + 0.5) * (w / n);
    box(g, 0.5, 0.32, 0.03, '#141618', x, 1.0, -0.15);
    box(g, 0.46, 0.28, 0.01, '#23415e', x, 1.0, -0.13);
    box(g, 0.05, 0.1, 0.05, '#141618', x, 0.81, -0.17);
    box(g, 0.4, 0.02, 0.14, '#2a2d30', x, 0.77, 0.1);
  }
  return g;
}
function labCounter(w, kitchenSink = true) {
  const g = new THREE.Group();
  box(g, w, 0.86, 0.9, '#e9ecee', 0, 0.43, 0);
  box(g, w + 0.04, 0.05, 0.94, '#f5f6f6', 0, 0.885, 0);
  if (kitchenSink) {
    box(g, 0.5, 0.02, 0.38, '#9da6ac', w / 2 - 0.5, 0.915, 0);
    const tap = cylinder(g, 0.015, 0.35, 'steel', w / 2 - 0.5, 1.08, -0.25, 6);
    tap.rotation.x = 0.3;
  }
  for (let x = -w / 2 + 0.6; x < w / 2 - 0.3; x += 0.9) box(g, 0.02, 0.6, 0.01, '#c9ced2', x, 0.45, 0.455);
  return g;
}
function labCabinet() {
  const g = new THREE.Group();
  box(g, 1.6, 2.0, 0.5, '#e6e9eb', 0, 1.0, 0);
  box(g, 1.5, 1.0, 0.02, 'glass', 0, 1.45, 0.26);
  for (let y = 1.1; y < 1.95; y += 0.4) box(g, 1.5, 0.02, 0.45, '#cfd5d9', 0, y, 0);
  return g;
}
function labSink() {
  const g = new THREE.Group();
  box(g, 1.2, 0.86, 0.6, '#e9ecee', 0, 0.43, 0);
  box(g, 0.6, 0.04, 0.4, '#9da6ac', 0, 0.88, 0);
  return g;
}
function longKitchenSink(w) {
  const g = new THREE.Group();
  box(g, w, 0.86, 0.65, '#d7dbde', 0, 0.43, 0);
  box(g, w, 0.04, 0.7, 'steel', 0, 0.88, 0);
  for (let x = -w / 2 + 0.8; x < w / 2; x += 1.6) box(g, 0.7, 0.03, 0.45, '#7f878d', x, 0.9, 0);
  box(g, 0.9, 0.7, 0.5, '#f4f4f2', -w / 2 + 0.6, 1.3, 0.1);
  return g;
}
function longSteelTable(w) {
  const g = new THREE.Group();
  box(g, w, 0.04, 0.8, 'steel', 0, 0.9, 0);
  box(g, w - 0.1, 0.03, 0.7, 'steel', 0, 0.25, 0);
  for (const [x, z] of [[-w / 2 + 0.05, -0.35], [w / 2 - 0.05, -0.35], [-w / 2 + 0.05, 0.35], [w / 2 - 0.05, 0.35]]) box(g, 0.04, 0.9, 0.04, 'steel', x, 0.45, z);
  return g;
}
function whiteTable(w, d) {
  const g = new THREE.Group();
  box(g, w, 0.04, d, '#f4f5f5', 0, 0.75, 0);
  for (const [x, z] of [[-w / 2 + 0.05, -d / 2 + 0.05], [w / 2 - 0.05, -d / 2 + 0.05], [-w / 2 + 0.05, d / 2 - 0.05], [w / 2 - 0.05, d / 2 - 0.05]]) box(g, 0.04, 0.73, 0.04, 'frame', x, 0.37, z);
  return g;
}
function printer3D() {
  const g = new THREE.Group();
  box(g, 0.42, 0.04, 0.42, '#202326', 0, 0.02, 0);
  for (const x of [-0.19, 0.19]) box(g, 0.03, 0.5, 0.03, '#202326', x, 0.27, 0);
  box(g, 0.42, 0.04, 0.05, '#202326', 0, 0.52, 0);
  box(g, 0.08, 0.08, 0.08, '#e53935', 0.05, 0.44, 0);
  box(g, 0.3, 0.02, 0.3, '#cfd5d9', 0, 0.12, 0);
  return g;
}
function redPanel() {
  const g = new THREE.Group();
  box(g, 1.4, 2.2, 0.06, '#d32f2f', 0, 1.1, 0);
  return g;
}
function simulatorHead() {
  return memo('head', () => {
    const g = new THREE.Group();
    cylinder(g, 0.04, 0.18, 'steel', 0, 0.09, 0, 8);
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), mat('#e9c8a8'));
    c.scale.set(1, 1.2, 1); c.position.y = 0.3; g.add(c);
    box(g, 0.18, 0.05, 0.12, '#f3f3f3', 0, 0.22, 0.04);
    return g;
  }).clone();
}
function stretcher() {
  const g = new THREE.Group();
  box(g, 0.8, 0.12, 1.9, '#f3f5f6', 0, 0.75, 0);
  box(g, 0.82, 0.04, 1.92, 'steel', 0, 0.67, 0);
  for (const [x, z] of [[-0.35, -0.85], [0.35, -0.85], [-0.35, 0.85], [0.35, 0.85]]) box(g, 0.04, 0.67, 0.04, 'steel', x, 0.33, z);
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 1.0, 4, 8), mat('#e9c8a8'));
  m.rotation.x = PI / 2; m.position.set(0, 0.95, 0.05); g.add(m);
  return g;
}
function clinicCurtain(w) {
  const g = new THREE.Group();
  box(g, w, 1.9, 0.02, '#cfe3e8', 0, 1.2, 0);
  box(g, w, 0.03, 0.03, 'steel', 0, 2.2, 0);
  return g;
}
function roundTable(r, color) {
  const g = new THREE.Group();
  cylinder(g, r, 0.04, color, 0, 0.74, 0, 24);
  cylinder(g, 0.04, 0.72, 'frame', 0, 0.36, 0, 8);
  cylinder(g, 0.26, 0.03, 'frame', 0, 0.015, 0, 12);
  return g;
}
function platform(w, d) {
  const g = new THREE.Group();
  box(g, w, 0.3, d, '#5a4030', 0, 0.15, 0);
  return g;
}
function screen(w) {
  const g = new THREE.Group();
  box(g, w, w * 0.5, 0.03, '#f8f8f8', 0, w * 0.25, 0.02);
  box(g, w + 0.1, 0.08, 0.1, '#2b2e33', 0, w * 0.5 + 0.04, 0.02);
  return g;
}
function lectern() {
  const g = new THREE.Group();
  box(g, 0.55, 1.05, 0.45, '#6b4a33', 0, 0.52, 0);
  box(g, 0.6, 0.04, 0.5, '#5a3d28', 0, 1.07, -0.02);
  return g;
}
function auditoriumSeat() {
  return memo('dentalUnit', () => {
    const g = new THREE.Group();
    box(g, 0.5, 0.08, 0.46, '#1e2124', 0, 0.45, 0);
    box(g, 0.5, 0.5, 0.07, '#1e2124', 0, 0.78, 0.22);
    for (const x of [-0.27, 0.27]) box(g, 0.04, 0.6, 0.46, '#3a3e42', x, 0.3, 0.02);
    return g;
  }).clone();
}
function stage(w) {
  const g = new THREE.Group();
  box(g, w, 0.25, 1.4, '#6b4426', 0, 0.12, 0);
  box(g, w - 0.4, 1.0, 0.6, '#7b4a2a', 0, 0.75, 0.3);
  box(g, w - 0.3, 0.05, 0.7, '#5a3820', 0, 1.27, 0.3);
  for (const x of [-0.8, 0, 0.8]) { const s = chair('#2b1f17'); s.position.set(x, 0.25, -0.35); g.add(s); }
  return g;
}
function cubicle() {
  const g = new THREE.Group();
  box(g, 0.03, 2.0, 1.4, '#c9ced3', -0.48, 1.1, 0);
  box(g, 0.03, 2.0, 1.4, '#c9ced3', 0.48, 1.1, 0);
  box(g, 0.94, 2.0, 0.03, '#d7dbdf', 0, 1.1, 0.7);
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.4, 12), mat('#f6f6f6'));
  s.position.set(0, 0.2, -0.4); g.add(s);
  return g;
}
function doubleSink() {
  const g = new THREE.Group();
  box(g, 1.8, 0.1, 0.55, '#d9d4cc', 0, 0.85, 0);
  for (const x of [-0.45, 0.45]) box(g, 0.4, 0.03, 0.32, '#f7f7f7', x, 0.9, 0);
  box(g, 1.8, 0.9, 0.02, '#c7d6dd', 0, 1.6, -0.27);
  return g;
}
function puff() {
  const g = new THREE.Group();
  const p = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), mat('#1f3a8a'));
  p.scale.set(1, 0.5, 1.1); p.position.y = 0.25; g.add(p);
  return g;
}
function pingPongTable() {
  const g = new THREE.Group();
  box(g, 1.52, 0.04, 2.74, '#1d4f91', 0, 0.76, 0);
  box(g, 1.52, 0.005, 0.02, '#ffffff', 0, 0.785, 0);
  box(g, 0.01, 0.005, 2.74, '#ffffff', 0, 0.785, 0);
  box(g, 1.7, 0.15, 0.02, '#e8e8e8', 0, 0.86, 0);
  for (const z of [-1.1, 1.1]) box(g, 1.2, 0.74, 0.06, '#2b2e33', 0, 0.37, z);
  return g;
}
function treadmill() {
  const g = new THREE.Group();
  box(g, 0.75, 0.2, 1.8, '#2a2d30', 0, 0.1, 0);
  box(g, 0.55, 0.02, 1.5, '#111', 0, 0.21, 0);
  for (const x of [-0.33, 0.33]) box(g, 0.05, 1.2, 0.05, '#4a4f54', x, 0.8, -0.8);
  box(g, 0.75, 0.25, 0.25, '#3a3e42', 0, 1.35, -0.85);
  return g;
}
function exerciseBike() {
  const g = new THREE.Group();
  box(g, 0.5, 0.06, 1.1, '#2a2d30', 0, 0.03, 0);
  box(g, 0.08, 0.8, 0.08, '#c62828', 0, 0.45, 0.2);
  box(g, 0.25, 0.06, 0.3, '#111', 0, 0.88, 0.25);
  box(g, 0.08, 1.0, 0.08, '#c62828', 0, 0.6, -0.35);
  cylinder(g, 0.25, 0.08, '#4a4f54', 0, 0.3, -0.35, 16).rotation.z = PI / 2;
  return g;
}
function railing(L) {
  const g = new THREE.Group();
  box(g, L, 0.05, 0.05, 'frame', 0, 1.05, 0);
  for (let x = -L / 2; x <= L / 2; x += 1.2) box(g, 0.04, 1.05, 0.04, 'frame', x, 0.52, 0);
  box(g, L, 1.0, 0.02, 'glass', 0, 0.55, 0);
  return g;
}
function curtains(k, g, s, color = '#9aa3a8') {
  if (Math.abs(g.xe) < 1) return;
  for (let z = s.z0 + 0.8; z < s.z1 - 0.6; z += 2.2) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.5, 0.7), mat(color));
    c.position.set(g.xe - g.sg * 0.15, 1.85, z);
    k.add(c);
  }
}

function textureBacking() {
  return memo('backing', () => {
    const [cv, g] = canvas(512, 256);
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 512, 256);
    g.font = 'bold 18px sans-serif';
    for (let y = 18; y < 256; y += 36)
      for (let x = (y / 36) % 2 ? 0 : 50; x < 512; x += 100) {
        g.fillStyle = '#00a9c6'; g.fillRect(x, y - 12, 14, 18);
        g.fillStyle = '#80bb27'; g.fillRect(x + 6, y - 12, 8, 18);
        g.fillStyle = '#5b5f63'; g.fillText('UCC', x + 20, y + 4);
      }
    return texture(cv, false);
  });
}

export { textureBoard, puff, treadmill, exerciseBike, pingPongTable };
