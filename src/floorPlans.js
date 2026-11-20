import * as THREE from 'three';
import { HEIGHT, mat, canvas, texture } from './walkthrough.js';
import { levelsA, levelsB } from './blocks.js';

/*
 * Furnished floor plans of the interior of the blocks, made from the campus photos.
 * Coordinates in meters inside the block: x from left to right and z from the back (-) to the
 * entrance (+). The exact layout of the walls is approximate; furniture, signs and
 * materials follow what is seen in the photos. Spaces without photos are marked "approximate".
 */

const PI = Math.PI, RIGHT = -PI / 2, LEFT = PI / 2;   // rotations: look towards +x (RIGHT) / -x (LEFT)

/* ======================================================================== Block B · Floor 1 */
function floor1(k) {
  k.setBounds(-11, -15, 11, 15);
  k.floor(-11, -15, 11, 15);

  // Glass facade towards the path (entrance with glass doors)
  k.glassWall(-11, 15, 11, 15, { openings: [[9.6, 12.4]] });
  k.door(-1.4, 15, 0, { glass: true, width: 1.3 });
  k.door(1.4, 15, PI, { glass: true, width: 1.3 });
  k.sign('SALIDA', 0, 2.7, 14.85, PI, 'exit');
  k.wall(-11, 15, -11, -15, { mat: 'brick' });
  k.wall(11, 15, 11, -15, { mat: 'brick' });
  k.wall(-11, -15, 11, -15, { mat: 'brick' });

  // Lobby: white wall on the left (AMI) and brick on the right (Admisiones)
  k.wall(-3, 15, -3, 3, { openings: [[8.6, 10]] });
  k.wall(-11, 3, -3, 3, { mat: 'brick' });
  k.wall(3, 15, 3, 3, { mat: 'brick', openings: [[2.6, 4.0]], windows: [[5.6, 8.8]] });
  k.wall(3, 3, 11, 3, { mat: 'brick' });
  k.door(3, 11.7, LEFT, { color: 'redDoor', width: 1.3 });
  k.sign(['ADMISIONES, REGISTRO Y', 'CONTROL ACADÉMICO', 'admissions and records'], 2.9, 2.5, 11.7, RIGHT, 'ucc');
  k.sign(['AMI', 'ICETEX', 'DARC', 'TESORERÍA', 'CONTABILIDAD'], -2.9, 1.65, 13.4, LEFT, 'ami');
  k.sign(['AMI · ICETEX', 'TESORERÍA · CONTABILIDAD'], -2.9, 2.55, 5.7, LEFT, 'ucc');
  k.placeObject(vendingMachine(), -2.45, 11.2, LEFT);
  k.placeObject(cutoutFigure(), -2.55, 12.45, LEFT + 0.3);
  k.placeObject(bins(['#2e7d32', '#212121', '#e8e8e8']), 2.55, 5.0, RIGHT);
  k.image(textureOpticalCircle(), 2.3, 2.3, 0, 0.012, 12.6, 0, true);
  k.lamps(0, 4.5, 0, 14, { axis: 'z', passage: 3 });
  k.pipes(-1.6, 15, -1.6, -12, HEIGHT - 0.1, 2);

  // Hall: blue benches, notice boards, stairs to Floor 2 and down to Floor 0
  k.wall(-3, 3, -3, -12, { mat: 'brick' });
  k.wall(3, 3, 3, -12, { mat: 'brick', openings: [[1.4, 2.6]] });
  k.wall(-3, -12, 3, -12, { mat: 'brick' });
  k.door(3, 1.0, LEFT, { color: '#3a3d40', width: 1.2, glass: true });
  k.placeObject(bench(5, '#2c3e9e'), -2.6, -0.6, LEFT);
  k.placeObject(noticeBoard(1.6, 1.1, '#244a39'), -2.9, -0.4, LEFT, false, 1.55);
  k.placeObject(noticeBoard(0.9, 1.4, '#f4f4f4'), -2.9, 1.6, LEFT, false, 1.4);
  k.staircase(-2.9, -0.8, -4, -10, 'down', { railings: [false, true] });
  k.staircase(-0.5, 2.0, -4, -11.5, 'up');
  k.sign(['Piso 0 · Lockers', 'Clínica Odontológica'], -1.85, 2.55, -3.95, 0, 'colgate', 'staircase');
  k.sign(['PISO 1 - Bloque B', 'first floor block b'], -2.9, 1.9, -3.1, LEFT, 'floor');
  k.portal(-2.9, -9, -0.8, -7.2, -1, 'arrival');
  k.lamps(0, -2, 0, 2, { axis: 'z', passage: 3 });

  // Service offices (left, no photos of the inside)
  for (const [z, name] of [[5, 'AMI'], [7.5, 'ICETEX'], [10, 'TESORERÍA'], [12.5, 'CONTABILIDAD']]) {
    k.placeObject(desk(), -9, z, LEFT);
    k.placeObject(chair('#2c3e9e'), -7.2, z, RIGHT);
    k.sign(name, -8.4, 2.45, z, LEFT, 'notice-blue');
  }
  k.placeObject(fileCabinet(), -10.6, 9, LEFT);
  k.placeObject(plant(), -3.6, 3.6, 0);
  k.lamps(-7, 5, -7, 13, { axis: 'z', passage: 4 });

  // Admisiones, Registro y Control Académico (right, no photos of the inside)
  for (const z of [5.5, 8.5, 11.5]) {
    k.placeObject(desk(), 8.6, z, RIGHT);
    k.placeObject(chair('#2c3e9e'), 6.8, z, LEFT);
  }
  k.placeObject(fileCabinet(), 10.6, 13.6, RIGHT);
  k.placeObject(fileCabinet(), 10.6, 4.2, RIGHT);
  k.placeObject(plant(), 4.0, 14.3, 0);
  k.lamps(7, 5, 7, 13, { axis: 'z', passage: 4 });

  // To the right of the hall: Bienestar Universitario and the gym (built by blocks.js → floor1Full)

  k.zone('entrance', -3, 3, 3, 15);
  k.zone('room', -3, -12, 3, 3);
  k.zone('treasury', -11, 3, -3, 15);
  k.zone('admissions', 3, 3, 11, 15);
}

/* ======================================================================== Block B · Floor 0 (basement 1) */
function floor0(k) {
  k.setBounds(-11, -15, 11, 15);
  k.floor(-11, -15, 11, 15);
  k.box(8, 0.012, 12, mat('#d9c8a4'), -7, 0.006, -5);        // beige floor of the cubby area
  k.wall(-11, 15, -11, -15, { mat: 'brick' });
  k.wall(11, 15, 11, -15);
  k.wall(-11, -15, 11, -15, { mat: 'brick' });
  k.wall(-11, 15, 11, 15);

  // Stairs up to Floor 1 (arrival)
  k.staircase(-2.9, -0.8, 6, 12, 'up', { railings: [false, true] });
  k.portal(-2.9, 8.6, -0.8, 10, 1, 'fromFloor0');
  k.wall(-3, 15, -3, 4.5, { mat: 'brick' });
  k.wall(-0.8, 12, 3.4, 12);
  k.sign(['PISO 0 - Bloque B', 'floor zero block b'], -2.9, 1.9, 5.2, LEFT, 'floor');

  // Lockers corridor
  k.placeObject(lockers({ cols: 3, rows: 4, type: 'glass' }), -2.7, 0, LEFT);
  k.placeObject(lockers({ cols: 4, rows: 3, type: 'colors' }), 1.15, -1.2, RIGHT);
  k.placeObject(lockers({ cols: 4, rows: 4, type: 'glass' }), 1.15, -4.2, RIGHT);
  k.placeObject(lockers({ cols: 4, rows: 3, type: 'colors' }), 3.05, -6.6, RIGHT);
  k.placeObject(lockers({ cols: 3, rows: 3, type: 'colors' }), 3.05, 3.4, RIGHT);
  k.placeObject(bins(['#1565c0', '#2e7d32', '#9e9e9e']), -2.55, -9.8, LEFT);
  k.placeObject(plant(), 2.4, -14.3, 0);
  k.door(0.4, -14.95, 0, { color: 'whiteDoor', isOpen: false, width: 1.1 });
  k.wall(-3, -11, -3, -15, { mat: 'brick' });
  k.placeObject(extinguisher(), -2.85, -13, LEFT, false, 1.0);
  k.lamps(0.2, -14, 0.2, 4, { axis: 'z', passage: 3 });
  k.pipes(-1.2, 12, -1.2, -15, HEIGHT - 0.1, 3);

  // Morphology Laboratory and practice room (glass offices on the right)
  k.glassWall(3.4, 5, 3.4, -12, { strip: true, openings: [[2.5, 3.5], [6.8, 8.0]] });
  k.wall(3.4, -0.4, 11, -0.4);
  k.wall(3.4, 5, 11, 5);
  k.wall(3.4, -12, 11, -12);
  k.sign(['LABORATORIO DE', 'MORFOLOGÍA', 'morphology lab'], 3.3, 2.0, -1.2, RIGHT, 'ucc');
  k.image(textureUccLogo(), 0.9, 0.9, 3.33, 1.45, -2.4, RIGHT);
  k.placeObject(poster('conduct'), 3.32, -4.4, RIGHT, false, 1.0);
  for (const z of [-3.4, -6.5, -9.6]) {
    k.placeObject(steelTable(), 7.2, z, 0);
    for (const [dx, dz] of [[-0.75, 0.75], [0.75, 0.75], [-0.75, -0.75], [0.75, -0.75]]) k.placeObject(stool(), 7.2 + dx * 1.3, z + dz, 0, false);
  }
  k.placeObject(shelf(3, 2, 'models'), 10.7, -6, RIGHT);
  k.placeObject(sink(), 7.2, -11.55, 0);
  k.image(textureBoard(), 2.4, 1.2, 7.2, 1.6, -0.5, PI);
  k.lamps(7.2, -11, 7.2, -1.5, { axis: 'z', passage: 3 });
  k.placeObject(woodTable(2, 1), 7.2, 2.4, 0);
  k.placeObject(shelf(2.2, 2, 'folders'), 10.7, 2.4, RIGHT);
  k.lamps(7.2, 1, 7.2, 4, { axis: 'z', passage: 3 });

  // Morphology cubby area (left, open with columns)
  k.wall(-11, -11, -3, -11, { mat: 'brick' });
  k.wall(-11, 1, -3, 1, { mat: 'brick' });
  for (const z of [-2.5, -7.5]) k.placeObject(column(), -3, z, 0);
  k.placeObject(lockers({ cols: 6, rows: 5, type: 'metal' }), -6.8, -10.6, 0);
  k.placeObject(lockers({ cols: 6, rows: 5, type: 'metal' }), -10.6, -5.2, RIGHT);
  const helmetBench = lockers({ cols: 5, rows: 5, type: 'metal' });
  for (const x of [-0.4, 0.3]) {
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), mat('black'));
    helmet.position.set(x, 2.58, 0);
    helmetBench.add(helmet);
  }
  k.placeObject(helmetBench, -6.5, -4.6, 0);
  k.placeObject(woodTable(1.8, 0.9), -6.2, -1.6, 0);
  k.placeObject(cabinet(), -9.6, 0.55, PI);
  k.placeObject(bins(['#e8e8e8', '#212121', '#2e7d32']), -3.6, -9.5, LEFT);
  k.lamps(-7, -9, -7, 0, { axis: 'z', passage: 3 });

  // Way down to the Dental Clinic (stairs in a glass box)
  k.staircase(-8.6, -5.4, 5, 11, 'down');
  k.glassWall(-9, 4.6, -9, 12);
  k.glassWall(-5, 4.6, -5, 12);
  k.wall(-9, 12, -5, 12);
  k.sign(['Clínica', 'Odontológica'], -7, 2.6, 4.55, PI, 'colgate', 'dentalChair');
  k.sign(['CLÍNICA ODONTOLÓGICA', '9901  ›'], -10.9, 1.7, 3.2, RIGHT, 'ucc');
  k.sign('SALIDA', -7, 2.82, 4.6, PI, 'exit');
  k.portal(-8.6, 7.4, -5.4, 9.2, -2, 'arrival');
  k.lamps(-7, 2.5, -7, 2.5, { axis: 'x' });

  k.zone('lockers', -3, -15, 3.4, 4.5);
  k.zone('arrival', -3, 4.5, 3.4, 15);
  k.zone('morphology', 3.4, -12, 11, -0.4);
  k.zone('practice', 3.4, -0.4, 11, 5);
  k.zone('cubbies', -11, -11, -3, 1);
  k.zone('downToClinic', -11, 1, -3, 15);
}

/* ======================================================================== Block B · Basement 2 (Dental Clinic) */
function basement2(k) {
  k.setBounds(-12, -16, 12, 16);
  k.floor(-12, -16, 12, 16, 'tile');
  k.wall(-12, 16, -12, -16);
  k.wall(12, 16, 12, -16, { windows: [[1, 2.8], [3.2, 5], [5.4, 7.2]] });
  k.wall(-12, -16, 12, -16);
  k.wall(-12, 16, -1, 16);
  k.wall(-1, 16, 2, 16, { mat: 'brick' });
  k.wall(2, 16, 12, 16);

  // Arrival by the stairs from Floor 0
  k.staircase(-11.6, -8.6, 10, 15.6, 'up', { railings: [false, true] });
  k.portal(-11.6, 12.4, -8.6, 13.6, -1, 'fromClinic');
  k.sign(['CLÍNICA ODONTOLÓGICA', 'dental clinic'], -10.1, 2.65, 9.7, 0, 'ucc');

  // Waiting room (glass with black frames)
  k.glassWall(-6, 16, -6, 8);
  k.glassWall(-6, 8, 12, 8, { openings: [[5, 7.4]] });
  k.sign(['SALA DE ESPERA', 'waiting room'], -2.6, 1.85, 7.97, PI, 'ucc');
  k.sign('SALIDA', 3.3, 2.4, 7.97, PI, 'exit');
  for (const z of [10.2, 11.5, 12.8, 14.1]) {
    k.placeObject(bench(4, '#245f5b'), 0.6, z, PI);
    k.placeObject(bench(4, '#245f5b'), 5.2, z, PI);
    k.placeObject(bench(4, '#245f5b'), 9.6, z, PI);
  }
  k.image(textureKidsMural(), 3.6, 2.3, -3.7, 1.45, 15.9, PI);
  k.placeObject(toyShelf(), -5.3, 14.2, LEFT);
  k.placeObject(abacus(), -4.6, 12.6, PI);
  k.placeObject(chain(), -2.0, 12.6, 0, false);
  k.placeObject(noticeBoard(1.5, 1.2, '#2b3f8c', 'endodontics'), 11.85, 11.2, RIGHT, false, 1.5);
  k.lamps(-3, 9.5, 11, 15, { type: 'panel', passage: 2.2 });

  // Corridor and row of services
  k.lamps(-10, 6, 10, 6, { axis: 'x', passage: 4 });
  // Customer service · Dental Deals · supplies storage
  k.wall(-12, 4, -6, 4, { serviceCounter: [[0.6, 4.4]], openings: [[4.8, 5.8]] });
  k.sign('Dental Deals', -10.9, 2.2, 4.1, 0, 'notice-blue');
  k.sign('ATENCIÓN AL USUARIO', -9.3, 2.2, 4.1, 0, 'notice-dark');
  k.sign(['ÁREA DE ALMACENAMIENTO', 'INSUMOS ESTUDIANTES'], -8.1, 2.65, 4.1, 0, 'notice-blue');
  k.placeObject(shelf(4.8, 2.2, 'products'), -9.2, -2.7, 0);
  k.placeObject(shelf(2.6, 2.2, 'supplies'), -11.7, 0.6, RIGHT);
  k.placeObject(desk(), -9.6, 2.5, PI);
  k.placeObject(desk(), -7.8, 2.5, PI);
  k.lamps(-9, -1.5, -9, 2.5, { axis: 'x', passage: 3 });
  // Restrooms
  k.wall(-6, 4, -2, 4);
  k.door(-5.0, 4.06, 0, { color: 'whiteDoor', isOpen: false });
  k.door(-3.0, 4.06, 0, { color: 'whiteDoor', isOpen: false });
  k.sign('BAÑOS', -5.0, 2.45, 4.1, 0, 'restrooms');
  k.sign('BAÑOS', -3.0, 2.45, 4.1, 0, 'restrooms');
  k.placeObject(extinguisher(), -1.85, 4.3, 0, false, 1.0);
  // Way to the undergraduate clinic
  k.sign(['Clínica', 'Odontológica'], 0, 2.65, 4.05, 0, 'colgate', 'dentalChair');
  // Clinical Records Archive
  k.wall(2, 4, 5.5, 4, { openings: [[0.4, 1.4]], windows: [[1.8, 3.3]] });
  k.sign(['Archivo de', 'Historias Clínicas'], 2.9, 2.65, 4.1, 0, 'colgate', 'archive');
  k.placeObject(woodTable(1.6, 0.9, '#7bc043'), 3.8, 0.6, 0);
  k.placeObject(chair('#f2f2f2', 'plastic'), 3.2, 1.4, PI);
  k.placeObject(chair('#f2f2f2', 'plastic'), 4.4, 1.4, PI);
  k.placeObject(chair('#202326'), 3.8, -0.3, 0);
  k.placeObject(shelf(3.2, 2.2, 'records'), 3.75, -2.7, 0);
  k.lamps(3.75, -1, 3.75, 2, { axis: 'x', passage: 3 });
  // Graduate Dental Clinic
  k.glassWall(5.5, 4, 12, 4, { strip: true, openings: [[1.6, 4.0]] });
  k.sign(['Clínica Odontológica', 'Postgrado'], 8.3, 2.65, 4.1, 0, 'colgate', 'dentalChair');
  for (const x of [6.8, 9.0, 11.2]) k.placeObject(dentalUnit(), x, -1.3, 0);
  for (const x of [7.9, 10.1]) k.partition(x, -3, x, 0.6);
  k.placeObject(desk(), 11.3, 2.6, RIGHT);
  k.lamps(9, -1.5, 9, 2.5, { axis: 'x', passage: 3 });
  // side walls of the row
  for (const x of [-6, -2, 2, 5.5]) k.wall(x, 4, x, -3);
  k.wall(-12, -3, -2, -3);
  k.wall(2, -3, 12, -3);

  // Undergraduate Dental Clinic: central aisle, columns and cubicles with partitions
  k.sign(['CLÍNICA ODONTOLÓGICA', 'dental clinic'], 0, 2.65, -2.95, 0, 'ucc');
  for (const z of [-5.6, -9.4, -13.2]) { k.placeObject(column(), -2.1, z, 0); k.placeObject(column(), 2.1, z, 0); }
  for (const z of [-5.2, -8.9, -12.6]) {
    for (const x of [-4.6, -9.0]) k.placeObject(dentalUnit(), x, z, LEFT);
    for (const x of [4.6, 9.0]) k.placeObject(dentalUnit(), x, z, RIGHT);
  }
  for (const z of [-7.05, -10.75, -14.4]) {
    k.partition(-2.6, z, -11.8, z);
    k.partition(2.6, z, 11.8, z);
  }
  k.placeObject(woodTable(1.6, 0.8, '#dcdcdc'), 0, -14.6, 0);
  for (const x of [-0.5, 0.5]) k.placeObject(chair('#202326'), x, -13.8, PI);
  k.door(0, -15.95, 0, { color: 'whiteDoor', isOpen: false, width: 1.1 });
  k.sign('☢ RADIOLOGÍA', 1.4, 2.0, -15.9, 0, 'notice');
  k.label('Zona de radiología (sin registrar)', 0, 2.6, -15.6);
  k.lamps(-9, -15, 9, -4, { axis: 'x', passage: 3.6 });

  k.zone('arrival', -12, 8, -6, 16);
  k.zone('room', -6, 8, 12, 16);
  k.zone('service', -12, -3, -6, 4);
  k.zone('archive', 2, -3, 5.5, 4);
  k.zone('graduate', 5.5, -3, 12, 4);
  k.zone('undergraduate', -12, -16, 12, -3);
}

/* ======================================================================== Block A · Floor 1 (Cafeteria) */
/*
 * Campus cafeteria / restaurant. Approximate layout: it will be adjusted with the videos.
 * Glass entrance towards the path, service counter with showcases, cash register, menu of the day,
 * microwave area, tables for 4 and a high counter next to the big windows.
 */
function cafeteria(k) {
  k.setBounds(-14, -10, 14, 10);
  k.floor(-14, -10, 14, 10, 'beige');
  k.glassWall(-14, 10, 14, 10, { openings: [[12.4, 15.6]] });
  k.door(-0.8, 10, 0, { glass: true, width: 1.5 });
  k.door(0.8, 10, PI, { glass: true, width: 1.5 });
  k.wall(-14, 10, -14, -10, { mat: 'brick', windows: [[2, 6], [8, 12], [14, 18]] });
  k.wall(14, 10, 14, -10, { mat: 'brick' });
  k.wall(-14, -10, 14, -10, { mat: 'cream' });
  k.sign(['CAFETERÍA', 'restaurante · bloque A'], 0, 2.65, 9.85, PI, 'ucc');
  k.sign('SALIDA', 3.2, 2.7, 9.85, PI, 'exit');

  // Service counter at the back with refrigerated showcases, cash register and menu
  k.placeObject(cafeteriaCounter(10), -2, -8.6, 0);
  k.image(textureMenu(), 4.2, 1.6, -2, 2.05, -9.9, 0);
  k.sign('CAJA', 4.3, 2.35, -7.4, 0, 'notice-blue');
  k.placeObject(cashRegister(), 4.3, -7.6, 0);
  k.placeObject(fridge('#c62828'), 9.2, -9.4, 0);
  k.placeObject(fridge('#1565c0'), 10.4, -9.4, 0);
  k.placeObject(shelf(2.4, 2.1, 'products'), 12.6, -9.5, 0);
  // Kitchen behind the counter (no access)
  k.obstacle(-8, -10, 4, -9.2);

  // Microwave area
  k.placeObject(woodTable(2.6, 0.6, '#dcdcdc'), -11.6, -9.4, 0);
  for (const x of [-12.5, -11.6, -10.7]) k.placeObject(microwave(), x, -9.4, 0, false, 0.78);
  k.sign('MICROONDAS', -11.6, 2.3, -9.9, 0, 'notice-dark');
  k.placeObject(bins(['#2e7d32', '#212121', '#e8e8e8']), -13.4, -6.2, LEFT);

  // Tables for 4 people
  for (const x of [-10, -5.5, -1, 3.5, 8])
    for (const z of [-3.6, 0.4, 4.4]) {
      if (x === -1 && z === 4.4) continue;   // free passage from the entrance
      k.placeObject(woodTable(1.2, 0.8, '#c9a26b'), x, z, 0);
      k.placeObject(chair('#e65100', 'plastic'), x - 0.35, z + 0.65, PI, false);
      k.placeObject(chair('#e65100', 'plastic'), x + 0.35, z + 0.65, PI, false);
      k.placeObject(chair('#e65100', 'plastic'), x - 0.35, z - 0.65, 0, false);
      k.placeObject(chair('#e65100', 'plastic'), x + 0.35, z - 0.65, 0, false);
    }
  // High counter with stools next to the window
  k.placeObject(woodTable(0.5, 10, '#8d6e63'), -13.5, 1, 0, true, 0.3);
  for (let z = -3.4; z <= 5.4; z += 1.1) k.placeObject(stool(), -12.9, z, 0, false);
  k.placeObject(plant(), 13.2, 9.2, 0);
  k.placeObject(plant(), -13.2, 9.2, 0);
  k.image(textureUccLogo(), 1.4, 1.4, 13.9, 1.7, 2, LEFT);
  k.label('Biblioteca (pisos 2 y 3) · próximamente', 12, 2.5, 6);
  k.lamps(-10, -6, 10, 6, { axis: 'x', passage: 4, type: 'panel' });

  k.zone('entrance', -4, 6, 4, 10);
  k.zone('bar', -8, -10, 6, -6);
  k.zone('tables', -14, -6, 14, 6);
}

/* ======================================================================== Interiors catalog */
export const INTERIORS = {
  A: {
    name: 'Bloque A',
    start: 1,
    levels: levelsA,
  },
  B: {
    name: 'Bloque B',
    start: 1,
    levels: levelsB([
      {
        id: 1, name: 'Piso 1 · Entrada', short: 'Piso 1', build: floor1,
        destinations: [
          { id: 'entrance', name: 'Entrada del Bloque B', x: 0, z: 13.6, yaw: 0 },
          { id: 'admissions', name: 'Admisiones, Registro y Control Académico', x: 4.4, z: 11.7, yaw: RIGHT, approximate: true,
            places: ['Admisiones, Registro y Control Académico (DARC)'], keys: ['Admisiones', 'Registro y Control'] },
          { id: 'treasury', name: 'AMI · ICETEX · Tesorería · Contabilidad', x: -4.3, z: 5.7, yaw: LEFT, approximate: true,
            places: ['Tesorería', 'Contabilidad', 'ICETEX y crédito estudiantil', 'AMI (Atención Más Integral)'], keys: ['Tesorería', 'ICETEX'] },
          { id: 'room', name: 'Sala de espera y escaleras', x: 0.4, z: -1.2, yaw: LEFT, places: ['Sala de espera del Piso 1'] },
          { id: 'stairs', name: 'Bajada al Piso 0', x: -1.85, z: -2.4, yaw: 0 },
          { id: 'fromFloor0', name: 'Llegada desde el Piso 0', x: -1.85, z: -2.6, yaw: PI, hidden: true },
        ],
      },
      {
        id: -1, name: 'Piso 0 (sótano 1)', short: 'Piso 0', build: floor0,
        destinations: [
          { id: 'arrival', name: 'Escaleras al Piso 1', x: -1.85, z: 5.1, yaw: 0 },
          { id: 'lockers', name: 'Lockers de estudiantes', x: -0.7, z: 1.5, yaw: 0, places: ['Lockers de estudiantes'], keys: ['lockers'] },
          { id: 'morphology', name: 'Laboratorio de Morfología', x: 4.4, z: -2.4, yaw: RIGHT, approximate: true,
            note: 'La entrada y el corredor son como en las fotos; el interior del laboratorio es aproximado.',
            places: ['Laboratorio de Morfología'], keys: ['Morfología'] },
          { id: 'cubbies', name: 'Casilleros de Morfología', x: -1.6, z: -4.6, yaw: LEFT },
          { id: 'practice', name: 'Coordinación Clínica · Administración Documental', x: 4.4, z: 2.0, yaw: RIGHT, approximate: true,
            places: ['Coordinación Clínica', 'Centro de Administración Documental'], keys: ['Coordinación Clínica', 'Administración Documental'] },
          { id: 'downToClinic', name: 'Bajada a la Clínica Odontológica', x: -7, z: 3.4, yaw: PI },
          { id: 'fromClinic', name: 'Llegada desde la clínica', x: -7, z: 3.4, yaw: 0, hidden: true },
        ],
      },
      {
        id: -2, name: 'Sótano 2 · Clínica Odontológica', short: 'Sótano 2', build: basement2, style: { floor: 'tile' },
        destinations: [
          { id: 'arrival', name: 'Escaleras al Piso 0', x: -10.1, z: 9.2, yaw: 0 },
          { id: 'room', name: 'Sala de espera de la clínica', x: 0.2, z: 6.6, yaw: PI, places: ['Sala de espera de la Clínica Odontológica'] },
          { id: 'service', name: 'Atención al Usuario · Dental Deals', x: -6.7, z: 5.6, yaw: 0.35,
            places: ['Atención al Usuario de la clínica', 'Dental Deals'], keys: ['Atención al Usuario'] },
          { id: 'restrooms', name: 'Baños', x: -4, z: 5.6, yaw: 0, places: ['Baños de la clínica'] },
          { id: 'archive', name: 'Archivo de Historias Clínicas', x: 3, z: 2.6, yaw: 0, places: ['Archivo de Historias Clínicas'] },
          { id: 'graduate', name: 'Clínica Odontológica de Posgrado', x: 8.3, z: 2.8, yaw: 0, places: ['Clínica Odontológica de Posgrado'], keys: ['Posgrado'] },
          { id: 'undergraduate', name: 'Clínica Odontológica (pregrado)', x: 0, z: -3.8, yaw: 0,
            places: ['Clínica Odontológica (pregrado)'], keys: ['Clínica Odontológica'] },
        ],
      },
    ]),
  },
};

/* ======================================================================== Furniture */
/* ---------- Cafeteria */
function cafeteriaCounter(w) {
  const g = new THREE.Group();
  box(g, w, 1.0, 0.8, '#6d4c41', 0, 0.5, 0);
  box(g, w + 0.1, 0.05, 0.9, '#eceff1', 0, 1.02, 0);
  // glass showcases on the counter
  for (let i = 0; i < 3; i++) {
    const x = -w / 2 + 1.4 + i * 1.9;
    box(g, 1.6, 0.5, 0.6, 'glass', x, 1.3, 0.05);
    box(g, 1.5, 0.04, 0.55, 'steel', x, 1.25, 0.05);
    for (let j = 0; j < 4; j++) cylinder(g, 0.07, 0.06, j % 2 ? '#d7a35b' : '#f0d9a8', x - 0.55 + j * 0.36, 1.1, 0.05, 10);
  }
  // trays
  box(g, w - 6.5, 0.04, 0.4, 'steel', w / 2 - 1.8, 1.06, 0.3);
  return g;
}
function cashRegister() {
  const g = new THREE.Group();
  box(g, 1.4, 1.05, 0.7, '#37474f', 0, 0.52, 0);
  box(g, 0.35, 0.25, 0.05, 'black', 0, 1.25, 0.1);
  box(g, 0.4, 0.12, 0.35, '#263238', 0, 1.11, 0.12);
  return g;
}
function fridge(color) {
  const g = new THREE.Group();
  box(g, 1.0, 2.0, 0.7, color, 0, 1.0, 0);
  box(g, 0.85, 1.6, 0.02, 'glass', 0, 1.05, 0.36);
  for (let y = 0.45; y < 1.8; y += 0.42) box(g, 0.8, 0.02, 0.6, 'steel', 0, y, 0);
  return g;
}
function microwave() {
  const g = new THREE.Group();
  box(g, 0.5, 0.3, 0.38, '#eceff1', 0, 0.15, 0);
  box(g, 0.32, 0.22, 0.02, 'black', -0.06, 0.15, 0.19);
  return g;
}
function textureMenu() {
  return memo('menu', () => {
    const [cv, g] = canvas(512, 196);
    g.fillStyle = '#1f2a22'; g.fillRect(0, 0, 512, 196);
    g.fillStyle = '#f9c74f'; g.font = 'bold 30px sans-serif'; g.fillText('MENÚ DEL DÍA', 24, 42);
    g.fillStyle = '#ffffff'; g.font = '20px sans-serif';
    ['Almuerzo ejecutivo', 'Sopa del día', 'Empanadas y pasteles', 'Jugos naturales', 'Café · tinto · aromática']
      .forEach((t, i) => g.fillText('• ' + t, 24 + (i > 2 ? 250 : 0), 84 + (i % 3) * 34));
    return texture(cv, false);
  });
}

function box(g, w, h, d, m, x, y, z) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof m === 'string' ? mat(m) : m);
  b.position.set(x, y, z);
  g.add(b);
  return b;
}
function cylinder(g, r, h, m, x, y, z, seg = 12) {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), typeof m === 'string' ? mat(m) : m);
  c.position.set(x, y, z);
  g.add(c);
  return c;
}

/** Lockers bank: 'colors' (blue/grey/green/white), 'glass' (white with a small window) or 'metal' (grey with padlock). */
function lockers({ cols = 4, rows = 4, type = 'colors' } = {}) {
  const g = new THREE.Group();
  const w = cols * 0.4, h = rows * 0.46, d = 0.48;
  box(g, w, h, d, type === 'glass' ? '#ecebe7' : type === 'metal' ? '#8b9399' : '#9aa1a6', 0, 0.12 + h / 2, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 0.04, 0.12, 0.04, 'steel', sx * (w / 2 - 0.05), 0.06, sz * (d / 2 - 0.05));
  const colors = ['#2f8fd8', '#575f66', '#34383c', '#6cbf34', '#f1f2f2', '#2f8fd8', '#34383c', '#6cbf34', '#575f66'];
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const x = -w / 2 + 0.2 + c * 0.4, y = 0.12 + 0.23 + r * 0.46, z = d / 2 + 0.012;
    const color = type === 'colors' ? colors[(c * 4 + r * 7 + cols) % colors.length] : type === 'glass' ? '#f6f5f2' : '#7f878d';
    box(g, 0.37, 0.43, 0.02, color, x, y, z);
    if (type === 'glass') box(g, 0.2, 0.3, 0.012, '#3b4850', x - 0.03, y + 0.02, z + 0.012);
    if (type === 'metal') box(g, 0.05, 0.06, 0.03, '#c9a227', x + 0.12, y, z + 0.02);
    if (type === 'colors') for (let i = 0; i < 3; i++) box(g, 0.015, 0.015, 0.005, '#222', x + 0.13, y + 0.12 - i * 0.03, z + 0.012);
    box(g, 0.02, 0.09, 0.03, '#2a2a2a', x + (type === 'glass' ? 0.14 : 0.13), y - 0.05, z + 0.02);
  }
  return g;
}

function vendingMachine() {
  const g = new THREE.Group();
  const front = new THREE.MeshStandardMaterial({ map: textureVending(), roughness: 0.4 });
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.95, 0.85), [mat('#d7d9d8'), mat('#d7d9d8'), mat('#d7d9d8'), mat('#d7d9d8'), front, mat('#d7d9d8')]);
  b.position.y = 0.975;
  g.add(b);
  return g;
}

function cutoutFigure() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.85), new THREE.MeshStandardMaterial({ map: textureFigure(), transparent: true, side: THREE.DoubleSide, alphaTest: 0.1 }));
  m.position.y = 0.95;
  g.add(m);
  box(g, 0.5, 0.03, 0.4, '#e9e9e9', 0, 0.015, 0.1);
  return g;
}

/** Bench of chairs joined by a beam (blue on Floor 1, green in the clinic). */
function bench(n, color) {
  const g = new THREE.Group();
  const width = n * 0.52;
  box(g, width, 0.06, 0.06, 'black', 0, 0.36, 0);
  for (const x of [-width / 2 + 0.2, width / 2 - 0.2]) {
    box(g, 0.05, 0.36, 0.05, 'black', x, 0.18, 0);
    box(g, 0.06, 0.03, 0.55, 'black', x, 0.015, 0);
  }
  const seat = new THREE.MeshStandardMaterial({ color, roughness: 0.35 });
  for (let i = 0; i < n; i++) {
    const x = -width / 2 + 0.26 + i * 0.52;
    box(g, 0.46, 0.07, 0.44, seat, x, 0.44, 0.03);
    const backrest = box(g, 0.44, 0.42, 0.05, seat, x, 0.72, -0.2);
    backrest.rotation.x = -0.12;
  }
  return g;
}

function chair(color, type = 'office') {
  const g = new THREE.Group();
  if (type === 'plastic') {
    box(g, 0.45, 0.05, 0.45, color, 0, 0.45, 0);
    box(g, 0.45, 0.4, 0.04, color, 0, 0.68, -0.21);
    for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) box(g, 0.04, 0.45, 0.04, color, x, 0.22, z);
  } else {
    box(g, 0.48, 0.08, 0.46, color, 0, 0.48, 0);
    box(g, 0.44, 0.5, 0.06, color, 0, 0.82, -0.22);
    cylinder(g, 0.03, 0.4, 'steel', 0, 0.26, 0);
    for (let i = 0; i < 5; i++) {
      const leg = box(g, 0.3, 0.03, 0.04, 'black', 0, 0.05, 0);
      leg.rotation.y = (i / 5) * PI * 2;
      leg.translateX(0.14);
    }
  }
  return g;
}

function desk() {
  const g = new THREE.Group();
  box(g, 1.4, 0.04, 0.7, '#e7e2d8', 0, 0.75, 0);
  box(g, 0.04, 0.73, 0.66, 'frame', -0.66, 0.37, 0);
  box(g, 0.04, 0.73, 0.66, 'frame', 0.66, 0.37, 0);
  box(g, 0.4, 0.6, 0.6, '#cfcac0', 0.42, 0.37, 0);
  box(g, 0.55, 0.34, 0.03, 'black', 0, 1.0, -0.2);
  const screen = box(g, 0.5, 0.29, 0.01, new THREE.MeshStandardMaterial({ color: '#3c6e9f', emissive: '#1b3550', emissiveIntensity: 0.6 }), 0, 1.0, -0.183);
  screen.rotation.y = 0;
  box(g, 0.06, 0.15, 0.06, 'black', 0, 0.82, -0.22);
  box(g, 0.45, 0.02, 0.15, '#2b2b2b', 0, 0.78, 0.05);
  const s = chair('#202326');
  s.position.z = 0.6;
  s.rotation.y = PI;
  g.add(s);
  return g;
}

function fileCabinet() {
  const g = new THREE.Group();
  box(g, 0.5, 1.3, 0.6, '#9aa0a6', 0, 0.65, 0);
  for (let i = 0; i < 4; i++) box(g, 0.18, 0.03, 0.02, 'steel', 0, 0.3 + i * 0.3, 0.31);
  return g;
}

function plant() {
  const g = new THREE.Group();
  const pot = cylinder(g, 0.22, 0.45, '#b5582f', 0, 0.22, 0);
  pot.geometry = new THREE.CylinderGeometry(0.24, 0.18, 0.45, 12);
  const leaf = new THREE.MeshStandardMaterial({ color: '#3f7f3a', side: THREE.DoubleSide });
  for (let i = 0; i < 9; i++) {
    const h = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.9, 4), leaf);
    h.position.set(0, 0.85, 0);
    h.rotation.set(0.5 + (i % 3) * 0.15, (i / 9) * PI * 2, 0, 'YXZ');
    h.translateY(0.2);
    g.add(h);
  }
  return g;
}

function bins(colors) {
  const g = new THREE.Group();
  colors.forEach((c, i) => {
    box(g, 0.38, 0.75, 0.4, c, -0.42 + i * 0.42, 0.38, 0);
    box(g, 0.4, 0.06, 0.42, c, -0.42 + i * 0.42, 0.78, 0);
  });
  box(g, 1.3, 0.04, 0.05, 'black', 0, 0.02, 0.22);
  return g;
}

function noticeBoard(w, h, background, type) {
  const g = new THREE.Group();
  box(g, w + 0.1, h + 0.1, 0.04, '#9a7650', 0, 0, 0);
  if (type === 'endodontics') {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: textureEndodontics() }));
    m.position.z = 0.025; g.add(m);
  } else {
    box(g, w, h, 0.05, background, 0, 0, 0);
    for (const [x, y, ww, hh] of [[-0.4, 0.2, 0.3, 0.4], [0, 0.25, 0.25, 0.32], [0.35, 0.1, 0.3, 0.45], [-0.1, -0.25, 0.3, 0.3]])
      if (Math.abs(x) < w / 2 - 0.1) box(g, ww, hh, 0.01, '#fbfbf8', x * w / 1.6, y * h / 1.1, 0.03);
  }
  return g;
}

function poster(type) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.0), new THREE.MeshStandardMaterial({ map: textureCodeOfConduct() }));
  g.add(m);
  return g;
}

function column() {
  const g = new THREE.Group();
  box(g, 0.5, HEIGHT, 0.5, 'white', 0, HEIGHT / 2, 0);
  return g;
}

function extinguisher() {
  const g = new THREE.Group();
  cylinder(g, 0.09, 0.5, '#c62828', 0, 0, 0.12);
  cylinder(g, 0.03, 0.08, 'black', 0, 0.29, 0.12);
  box(g, 0.3, 0.6, 0.03, '#d7d7d7', 0, 0, 0.0);
  return g;
}

function steelTable() {
  const g = new THREE.Group();
  box(g, 2.2, 0.05, 1.0, 'steel', 0, 0.9, 0);
  for (const [x, z] of [[-1, -0.42], [1, -0.42], [-1, 0.42], [1, 0.42]]) box(g, 0.05, 0.88, 0.05, 'steel', x, 0.44, z);
  box(g, 2.1, 0.03, 0.9, 'steel', 0, 0.25, 0);
  return g;
}

function stool() {
  const g = new THREE.Group();
  cylinder(g, 0.17, 0.06, 'black', 0, 0.62, 0);
  cylinder(g, 0.025, 0.6, 'steel', 0, 0.3, 0);
  cylinder(g, 0.2, 0.02, 'steel', 0, 0.01, 0);
  return g;
}

function sink() {
  const g = new THREE.Group();
  box(g, 2.4, 0.9, 0.6, '#e9eaea', 0, 0.45, 0);
  box(g, 0.6, 0.05, 0.4, 'steel', -0.6, 0.91, 0);
  box(g, 0.6, 0.05, 0.4, 'steel', 0.6, 0.91, 0);
  for (const x of [-0.6, 0.6]) cylinder(g, 0.015, 0.3, 'steel', x, 1.05, -0.2);
  return g;
}

function woodTable(w, d, color = '#b88a5a') {
  const g = new THREE.Group();
  box(g, w, 0.05, d, color, 0, 0.75, 0);
  for (const [x, z] of [[-w / 2 + 0.06, -d / 2 + 0.06], [w / 2 - 0.06, -d / 2 + 0.06], [-w / 2 + 0.06, d / 2 - 0.06], [w / 2 - 0.06, d / 2 - 0.06]])
    box(g, 0.05, 0.73, 0.05, color === '#7bc043' ? '#c8c8c8' : '#7a5530', x, 0.37, z);
  return g;
}

function cabinet() {
  const g = new THREE.Group();
  box(g, 1.0, 1.8, 0.5, '#f1f1ee', 0, 0.9, 0);
  box(g, 0.01, 1.7, 0.02, '#cfcfcf', 0, 0.9, 0.26);
  return g;
}

/** Shelf with a drawn front: 'folders', 'records' (green folders), 'products', 'supplies', 'models'. */
function shelf(w, h, type) {
  const g = new THREE.Group();
  const front = new THREE.MeshStandardMaterial({ map: textureBookshelf(type, w, h) });
  const side = mat(type === 'supplies' ? '#d8d2c8' : '#44484c');
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.45), [side, side, side, side, front, side]);
  b.position.y = h / 2;
  g.add(b);
  if (type === 'models') {   // anatomical models on the shelf
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), mat('#e8dcc8'));
      c.position.set(-w / 2 + 0.4 + i * (w - 0.8) / 3, h + 0.11, 0);
      g.add(c);
    }
  }
  return g;
}

/** Dental unit: blue chair, lamp, module with spittoon, stool and red bin. */
function dentalUnit() {
  const g = new THREE.Group();
  const blue = new THREE.MeshStandardMaterial({ color: '#2a5d8f', roughness: 0.35 });
  box(g, 0.55, 0.42, 0.7, 'white', 0, 0.21, 0.1);
  box(g, 0.62, 0.12, 1.1, blue, 0, 0.58, 0.35);                     // seat and legs
  const backrest = box(g, 0.6, 0.1, 0.75, blue, 0, 0.78, -0.45);
  backrest.rotation.x = 0.55;
  box(g, 0.3, 0.1, 0.22, blue, 0, 1.02, -0.86);                     // headrest
  for (const s of [-1, 1]) box(g, 0.06, 0.06, 0.45, 'white', s * 0.35, 0.7, 0.05);
  // side module and spittoon
  box(g, 0.45, 0.85, 0.45, 'white', 0.65, 0.42, -0.45);
  cylinder(g, 0.12, 0.08, '#d9e3e8', 0.65, 0.9, -0.45);
  // articulated lamp
  cylinder(g, 0.03, 1.55, 'white', -0.42, 0.95, -0.85);
  const arm = box(g, 0.06, 0.06, 0.8, 'white', -0.42, 1.72, -0.5);
  arm.rotation.x = 0.3;
  box(g, 0.3, 0.1, 0.18, 'white', -0.25, 1.55, -0.2);
  box(g, 0.24, 0.02, 0.12, 'light', -0.25, 1.49, -0.2);
  // instrument tray
  cylinder(g, 0.02, 0.5, 'steel', 0.5, 0.9, 0.55);
  box(g, 0.45, 0.03, 0.32, '#e7ecef', 0.5, 1.15, 0.55);
  // student's stool and red bin
  const t = stool(); t.position.set(-0.75, 0, -0.1); g.add(t);
  const bin = cylinder(g, 0.15, 0.4, '#d32f2f', 0.75, 0.2, 0.45);
  bin.geometry = new THREE.CylinderGeometry(0.16, 0.13, 0.4, 12);
  return g;
}

function toyShelf() {
  const g = new THREE.Group();
  const green = '#a4d65e';
  for (const y of [0.02, 0.45, 0.88]) box(g, 1.0, 0.04, 0.4, green, 0, y, 0);
  for (const x of [-0.48, 0.48]) box(g, 0.04, 0.9, 0.4, green, x, 0.45, 0);
  ['#e53935', '#fdd835', '#1e88e5', '#8e24aa', '#ff7043'].forEach((c, i) =>
    box(g, 0.16, 0.16, 0.16, c, -0.35 + i * 0.17, i % 2 ? 0.55 : 0.12, 0));
  const plush = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), mat('#f5f5f5'));
  plush.position.set(0.2, 1.02, 0);
  g.add(plush);
  return g;
}

function abacus() {
  const g = new THREE.Group();
  for (const x of [-0.4, 0.4]) box(g, 0.05, 0.9, 0.05, '#8d5b34', x, 0.85, 0);
  for (const y of [0.4, 1.3]) box(g, 0.85, 0.05, 0.05, '#8d5b34', 0, y, 0);
  const colors = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#e53935'];
  colors.forEach((c, r) => {
    const y = 0.5 + r * 0.115;
    cylinder(g, 0.006, 0.8, 'steel', 0, y, 0).rotation.z = PI / 2;
    for (let i = 0; i < 6; i++) {
      const count = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat(c));
      count.position.set(-0.3 + i * 0.055 + (r % 3) * 0.06, y, 0);
      g.add(count);
    }
  });
  for (const x of [-0.4, 0.4]) box(g, 0.06, 0.04, 0.4, '#8d5b34', x, 0.4, 0);
  return g;
}

function chain() {
  const g = new THREE.Group();
  for (const x of [-0.6, 0.6]) {
    cylinder(g, 0.03, 0.9, 'steel', x, 0.45, 0);
    cylinder(g, 0.16, 0.03, 'black', x, 0.015, 0);
  }
  const c = box(g, 1.2, 0.03, 0.03, '#f2c230', 0, 0.75, 0);
  c.rotation.z = 0.05;
  return g;
}

/* ======================================================================== Furniture and decoration textures */
const cache = new Map();
function memo(password, f) { if (!cache.has(password)) cache.set(password, f()); return cache.get(password); }

function textureVending() {
  return memo('vending', () => {
    const [cv, g] = canvas(256, 512);
    g.fillStyle = '#f2efe9'; g.fillRect(0, 0, 256, 512);
    g.fillStyle = '#c9a77c'; g.fillRect(0, 0, 256, 90);
    g.fillStyle = '#ffffff'; g.font = 'bold 36px sans-serif'; g.textAlign = 'center'; g.fillText('vending', 128, 48);
    g.fillStyle = '#3f9b35'; g.font = 'italic 24px sans-serif'; g.fillText('en la vía', 160, 78);
    g.fillStyle = '#2d3339'; g.fillRect(24, 110, 170, 250);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) {
      g.fillStyle = ['#e53935', '#fdd835', '#43a047', '#fb8c00', '#1e88e5'][(r + c) % 5];
      g.fillRect(34 + c * 40, 122 + r * 47, 28, 32);
    }
    g.fillStyle = '#b8bec4'; g.fillRect(204, 140, 40, 120);
    g.fillStyle = '#3f9b35'; g.fillRect(0, 380, 256, 132);
    g.fillStyle = '#ffffff'; g.font = 'bold 26px sans-serif'; g.fillText('SIEMPRE', 128, 470);
    return texture(cv, false);
  });
}

function textureFigure() {
  return memo('figure', () => {
    const [cv, g] = canvas(160, 400);
    g.clearRect(0, 0, 160, 400);
    g.fillStyle = '#e0b48f'; g.beginPath(); g.arc(80, 48, 28, 0, 7); g.fill();
    g.fillStyle = '#3b2a20'; g.beginPath(); g.arc(80, 36, 29, PI, 0); g.fill();
    g.fillStyle = '#b3262b'; g.fillRect(44, 80, 72, 130);
    g.strokeStyle = '#1b1b1b'; g.lineWidth = 3;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(44 + i * 14, 80); g.lineTo(44 + i * 14, 210); g.stroke(); g.beginPath(); g.moveTo(44, 90 + i * 22); g.lineTo(116, 90 + i * 22); g.stroke(); }
    g.fillStyle = '#b3262b'; g.fillRect(116, 90, 34, 18); g.fillRect(12, 90, 34, 18);
    g.fillStyle = '#1d2128'; g.fillRect(50, 210, 26, 160); g.fillRect(84, 210, 26, 160);
    g.fillStyle = '#ffffff'; g.fillRect(44, 368, 36, 18); g.fillRect(82, 368, 36, 18);
    return texture(cv, false);
  });
}

export function textureOpticalCircle() {
  return memo('circle', () => {
    const [cv, g] = canvas(512, 512);
    g.clearRect(0, 0, 512, 512);
    for (let r = 0; r < 10; r++) {
      const rad = 250 - r * 24;
      for (let a = 0; a < 40; a++) {
        g.fillStyle = (a + r) % 2 ? '#111' : '#f5f5f5';
        g.beginPath(); g.moveTo(256, 256 + r * 9);
        g.arc(256, 256 + r * 9, rad, (a / 40) * PI * 2, ((a + 1) / 40) * PI * 2);
        g.closePath(); g.fill();
      }
    }
    return texture(cv, false);
  });
}

function textureUccLogo() {
  return memo('uccLogo', () => {
    const [cv, g] = canvas(256, 256);
    g.clearRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(120,125,130,0.75)'; g.lineWidth = 34;
    g.beginPath(); g.moveTo(70, 30); g.lineTo(70, 150); g.arc(120, 150, 50, PI, 0, true); g.lineTo(170, 70); g.stroke();
    g.lineWidth = 22;
    g.beginPath(); g.arc(178, 120, 40, PI * 0.35, PI * 1.65); g.stroke();
    return texture(cv, false);
  });
}

function textureCodeOfConduct() {
  return memo('conduct', () => {
    const [cv, g] = canvas(256, 366);
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 366);
    g.fillStyle = '#1f8f8a'; g.fillRect(0, 0, 256, 60); g.fillRect(0, 250, 256, 116);
    g.fillStyle = '#ffffff'; g.font = 'bold 24px sans-serif'; g.fillText('Código de Conducta', 12, 38);
    g.fillStyle = '#c62828';
    for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(22, 80 + i * 28, 9, 0, 7); g.fill(); }
    g.fillStyle = '#6b7780';
    for (let i = 0; i < 6; i++) g.fillRect(40, 76 + i * 28, 190, 6);
    return texture(cv, false);
  });
}

function textureBoard() {
  return memo('board', () => {
    const [cv, g] = canvas(256, 128);
    g.fillStyle = '#fbfbfb'; g.fillRect(0, 0, 256, 128);
    g.strokeStyle = '#9aa0a6'; g.lineWidth = 6; g.strokeRect(0, 0, 256, 128);
    g.fillStyle = '#3b6fb6'; g.font = '18px sans-serif'; g.fillText('Morfología humana', 20, 40);
    return texture(cv, false);
  });
}

function textureKidsMural() {
  return memo('mural', () => {
    const [cv, g] = canvas(512, 330);
    const gr = g.createLinearGradient(0, 0, 0, 330);
    gr.addColorStop(0, '#9fd9e8'); gr.addColorStop(1, '#bfe6a8');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 330);
    g.fillStyle = '#4b2c83'; g.font = 'bold 48px "Comic Sans MS", sans-serif'; g.textAlign = 'center';
    g.strokeStyle = '#ffffff'; g.lineWidth = 8;
    g.strokeText('Clínica', 256, 66); g.fillText('Clínica', 256, 66);
    g.strokeText('Odontológica', 256, 116); g.fillText('Odontológica', 256, 116);
    const kid = (x, skin, clothes, hair) => {
      g.fillStyle = clothes; g.fillRect(x - 32, 210, 64, 80);
      g.fillStyle = skin; g.beginPath(); g.arc(x, 180, 34, 0, 7); g.fill();
      g.fillStyle = hair; g.beginPath(); g.arc(x, 166, 34, PI, 0); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, 192, 14, 0, PI); g.fill();
    };
    kid(150, '#7b4a2e', '#3f9b35', '#2b1a10');
    kid(256, '#f2c9a5', '#8e5bd0', '#f6c445');
    kid(362, '#f2c9a5', '#e98ab0', '#7a4a2a');
    g.fillStyle = '#ffffff';
    for (const [x, y] of [[60, 250], [470, 230], [430, 70], [80, 80]]) { g.fillRect(x - 14, y - 40, 28, 70); g.fillStyle = '#5fb3e0'; g.fillRect(x - 14, y - 40, 28, 14); g.fillStyle = '#ffffff'; }
    g.fillStyle = '#2e7d32'; g.font = 'bold 20px sans-serif'; g.fillText('UNIVERSIDAD COOPERATIVA DE COLOMBIA', 256, 318);
    return texture(cv, false);
  });
}

function textureEndodontics() {
  return memo('endo', () => {
    const [cv, g] = canvas(300, 240);
    g.fillStyle = '#28408f'; g.fillRect(0, 0, 300, 240);
    g.fillStyle = '#ffffff'; g.font = 'bold 22px sans-serif'; g.fillText('TRATAMIENTO DE', 20, 34); g.fillText('ENDODONCIA', 20, 60);
    for (let i = 0; i < 6; i++) { g.fillStyle = ['#ffd54f', '#81d4fa', '#ef9a9a'][i % 3]; g.fillRect(20 + (i % 3) * 92, 80 + Math.floor(i / 3) * 76, 80, 64); }
    return texture(cv, false);
  });
}

function textureBookshelf(type, w, h) {
  return memo(`estante:${type}:${w}:${h}`, () => {
    const W = Math.round(w * 100), H = Math.round(h * 100);
    const [cv, g] = canvas(W, H);
    g.fillStyle = type === 'supplies' ? '#d8d2c8' : '#3b3f43'; g.fillRect(0, 0, W, H);
    const rows = type === 'supplies' ? 7 : 5;
    let seed = 5;
    const random = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let f = 0; f < rows; f++) {
      const y0 = 6 + f * (H - 12) / rows, height = (H - 12) / rows - 8;
      g.fillStyle = type === 'supplies' ? '#bdb6aa' : '#25282b'; g.fillRect(4, y0 + height, W - 8, 6);
      if (type === 'supplies') {
        for (let x = 6; x < W - 30; x += 26) { g.fillStyle = ['#c62828', '#c8b48a', '#e7e1d6'][Math.floor(random() * 3)]; g.fillRect(x, y0 + 4, 22, height - 6); g.fillStyle = '#5a5a5a'; g.fillRect(x + 8, y0 + height / 2, 6, 4); }
      } else if (type === 'products') {
        for (let x = 6; x < W - 14; x += 14 + random() * 8) { g.fillStyle = ['#e53935', '#1e88e5', '#fdd835', '#ffffff', '#43a047', '#f48fb1'][Math.floor(random() * 6)]; const hh = height * (0.4 + random() * 0.5); g.fillRect(x, y0 + height - hh, 10, hh); }
      } else if (type === 'models') {
        for (let x = 10; x < W - 30; x += 40) { g.fillStyle = '#e8dcc8'; g.beginPath(); g.arc(x + 14, y0 + height - 14, 12, 0, 7); g.fill(); }
      } else {
        const green = type === 'records';
        for (let x = 6; x < W - 8; x += 7) { g.fillStyle = green ? ['#2e7d32', '#388e3c', '#1b5e20'][Math.floor(random() * 3)] : ['#1565c0', '#f9a825', '#6d4c41', '#c62828', '#9e9e9e'][Math.floor(random() * 5)]; g.fillRect(x, y0 + 4, 5, height - 4); }
      }
    }
    return texture(cv, false);
  });
}

/* Furniture and textures reused by the floor generator (floors.js) */
export {
  lockers, bench, chair, desk, fileCabinet, plant, bins, noticeBoard, extinguisher,
  woodTable, shelf, stool, box, cylinder, memo, textureUccLogo, textureBoard,
  floor1, floor0, basement2, cafeteria, cafeteriaCounter, cashRegister, fridge, microwave, textureMenu, cutoutFigure,
};
