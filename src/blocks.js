import * as THREE from 'three';
import { HEIGHT, mat } from './walkthrough.js';
import { level, levelName, puff, treadmill, exerciseBike } from './floors.js';
import {
  floor1, floor0, basement2, cafeteriaCounter, cashRegister, fridge, microwave, textureMenu, box, cylinder,
  shelf, woodTable, chair, plant, bins, lockers, bench, textureUccLogo, desk, fileCabinet,
} from './floorPlans.js';

/*
 * Floors of blocks A and B as they look and are narrated in the campus videos.
 * Block B: 22 m × 30 m, 7 floors and basements. Block A: 24 m × 44 m, 6 floors (courts on the rooftop) and basement.
 * The passages between blocks (floors 1, 3, 4 and 5, and the basements) lead from one block to the other.
 */

const PI = Math.PI, RIGHT = -PI / 2, LEFT = PI / 2;
const B = { W: 22, L: 30 }, A = { W: 24, L: 44, P: 3.2 };

// Arrivals when crossing a passage between blocks
const fromA = { id: 'fromA', name: 'Paso al Bloque A', x: 0, z: -B.L / 2 + 2, yaw: PI, hidden: true };
const fromB = { id: 'fromB', name: 'Paso al Bloque B', x: 0, z: -A.L / 2 + 2, yaw: PI, hidden: true };
const passageA = (n, arrival = 'fromB') => ({ connection: 'Bloque A', building: 'A', level: n, arrival });
const passageB = (n, arrival = 'fromA') => ({ connection: 'Bloque B', building: 'B', level: n, arrival });

/* ======================================================================== Block B */
const stairsB = (up, down) => ({ side: 'left', z0: -3, z1: 4.5, type: 'stairs', up, down });

const B2 = level({
  id: 2, name: 'Piso 2 · Salones', short: 'Piso 2', style: 'B', ...B,
  rooms: [
    { side: 'left', z0: -15, z1: -9, type: 'classroom', name: 'Salón 301', number: '301', places: ['Salones 301 a 305'], keys: ['salón 301', 'salones 300'] },
    { side: 'left', z0: -9, z1: -3, type: 'classroom', name: 'Salón 302', number: '302' },
    stairsB(3, 1),
    { side: 'left', z0: 4.5, z1: 9.75, type: 'classroom', name: 'Salón 303', number: '303' },
    { side: 'left', z0: 9.75, z1: 15, type: 'classroom', name: 'Salón 304', number: '304' },
    { side: 'right', z0: -15, z1: -6, type: 'classroom', name: 'Salón 305', number: '305',
      note: 'Así son los salones de la Universidad Cooperativa: sillas universitarias, tablero y proyector.' },
    { side: 'right', z0: -6, z1: 2, type: 'open', zone: 'waiting', name: 'Zona de espera', sign: false },
  ],
});

const B3 = level({
  id: 3, name: 'Piso 3 · Facultad de Medicina', short: 'Piso 3', style: 'B', ...B,
  ends: { north: passageA(3) },
  extraDestinations: [fromA],
  rooms: [
    { side: 'left', z0: -15, z1: -8, type: 'faculty', name: 'Facultad de Medicina',
      places: ['Facultad de Medicina'], keys: ['Facultad de Medicina', 'decanatura de Medicina'] },
    { side: 'left', z0: -8, z1: -3, type: 'office', name: 'Coordinación del programa de Medicina',
      places: ['Coordinación del programa de Medicina'], keys: ['coordinación de Medicina'] },
    stairsB(4, 2),
    { side: 'left', z0: 4.5, z1: 15, type: 'classroom', name: 'Salón de Medicina', number: 'Medicina' },
    { side: 'right', z0: -15, z1: -7, type: 'office', name: 'Oficinas de la Facultad de Medicina', logo: true },
    { side: 'right', z0: -7, z1: 4, type: 'classroom', name: 'Salón de clase', id: 'classroom-b3-1' },
    { side: 'right', z0: 4, z1: 15, type: 'classroom', name: 'Salón de clase', id: 'classroom-b3-2' },
  ],
});

const B4 = level({
  id: 4, name: 'Piso 4 · Facultad de Ingeniería', short: 'Piso 4', style: 'B', ...B,
  ends: { north: passageA(4) },
  extraDestinations: [fromA],
  rooms: [
    { side: 'left', z0: -15, z1: -9.5, type: 'classroom', name: 'Salón 401', number: '401' },
    { side: 'left', z0: -9.5, z1: -3, type: 'classroom', name: 'Salón 402', number: '402' },
    stairsB(5, 3),
    { side: 'left', z0: 4.5, z1: 9.5, type: 'teachers', name: 'Sala de profesores de Ingeniería', sign: ['Sala de profesores', '409'],
      places: ['Sala de profesores de Ingeniería'], keys: ['sala de profesores de Ingeniería', '409'] },
    { side: 'left', z0: 9.5, z1: 15, type: 'classroom', name: 'Salón 410', number: '410' },
    { side: 'right', z0: -15, z1: -8.5, type: 'faculty', name: 'Facultad de Ingeniería',
      sign: ['Facultad de Ingeniería', 'decanatura'],
      places: ['Facultad de Ingeniería'], keys: ['Facultad de Ingeniería', 'decanatura de Ingeniería', 'Ingeniería de Software'] },
    { side: 'right', z0: -8.5, z1: -2.5, type: 'lab', name: 'Laboratorio de Aplicaciones de la Física',
      places: ['Laboratorios de Ingeniería Industrial'], keys: ['laboratorio de física', 'Ingeniería Industrial'] },
    { side: 'right', z0: -2.5, z1: 3.5, type: 'lab', name: 'Laboratorio de Aplicaciones de la Química', keys: ['laboratorio de química'] },
    { side: 'right', z0: 3.5, z1: 9.5, type: 'lab', name: 'Laboratorio de Bioprocesos y Biotecnología', keys: ['bioprocesos', 'biotecnología'] },
    { side: 'right', z0: 9.5, z1: 15, type: 'hearings', name: 'Salas de audiencia de Derecho',
      places: ['Salas de audiencia de Derecho'], keys: ['salas de audiencia'] },
  ],
});

const B5 = level({
  id: 5, name: 'Piso 5 · Enfermería y Derecho', short: 'Piso 5', style: 'B', ...B,
  ends: { north: passageA(5) },
  extraDestinations: [fromA],
  rooms: [
    { side: 'left', z0: -15, z1: -9, type: 'faculty', name: 'Facultad de Enfermería', sign: ['Facultad de Enfermería', '501'],
      places: ['Facultad de Enfermería'], keys: ['Facultad de Enfermería', 'programa de Enfermería'] },
    { side: 'left', z0: -9, z1: -3, type: 'teachers', name: 'Sala de profesores de Enfermería' },
    stairsB(6, 4),
    { side: 'left', z0: 4.5, z1: 9.75, type: 'classroom', name: 'Salón 502', number: '502' },
    { side: 'left', z0: 9.75, z1: 15, type: 'classroom', name: 'Salón 503', number: '503' },
    { side: 'right', z0: -15, z1: -8, type: 'faculty', name: 'Facultad de Derecho',
      places: ['Facultad de Derecho'], keys: ['Facultad de Derecho'] },
    { side: 'right', z0: -8, z1: -2, type: 'classroom', name: 'Salón 504', number: '504' },
    { side: 'right', z0: -2, z1: 4, type: 'classroom', name: 'Salón 505', number: '505' },
    { side: 'right', z0: 4, z1: 9.5, type: 'classroom', name: 'Salón 506', number: '506' },
    { side: 'right', z0: 9.5, z1: 15, type: 'classroom', name: 'Salón 508', number: '508' },
  ],
});

const B6 = level({
  id: 6, name: 'Piso 6 · Laboratorios', short: 'Piso 6', style: 'BUpper', ...B,
  rooms: [
    { side: 'left', z0: -15, z1: -9, type: 'classroom', name: 'Salón 601', number: '601' },
    { side: 'left', z0: -9, z1: -3, type: 'classroom', name: 'Salón 602', number: '602' },
    stairsB(7, 5),
    { side: 'left', z0: 4.5, z1: 15, type: 'operations', name: 'Laboratorio de Operaciones',
      places: ['Laboratorio de Operaciones'], keys: ['laboratorio de operaciones'] },
    { side: 'right', z0: -15, z1: -4, type: 'innovation', name: 'Laboratorio de Innovación, Prototipado y Emprendimiento',
      sign: ['Laboratorio de Innovación,', 'Prototipado y Emprendimiento · 605'],
      places: ['Laboratorio de Innovación, Prototipado y Emprendimiento'], keys: ['laboratorio de innovación', 'impresoras 3D', '605'] },
    { side: 'right', z0: -4, z1: 4, type: 'open', zone: 'waiting', name: 'Zona de espera del piso 6', sign: false },
  ],
});

const B7 = level({
  id: 7, name: 'Piso 7 · Auditorio Urcunina', short: 'Piso 7', style: 'BUpper', ...B,
  rooms: [
    { side: 'left', z0: -15, z1: -3, type: 'auditorium', name: 'Auditorio Urcunina', sign: ['Auditorio Urcunina', 'aula 611'],
      wallColor: '#d8a943', places: ['Auditorio Urcunina'], keys: ['Urcunina', 'aula 611'] },
    stairsB(null, 6),
    { side: 'left', z0: 4.5, z1: 15, type: 'classroom', name: 'Salón 608', number: '608' },
    { side: 'right', z0: -15, z1: 1, type: 'classroom', name: 'Salón 610', number: '610', note: 'Salón muy grande con ventanales.' },
    { side: 'right', z0: 1, z1: 8, type: 'open', zone: 'backing', name: 'Muro de fotos UCC', sign: false },
  ],
});

/** Floor 1 of B (made from the photos) + stairs to Floor 2 and passage to Block A. */
function floor1Full(k) {
  floor1(k);
  wellbeing(k);
  k.portal(-0.5, -11.4, 2.0, -9.9, 2, 'stairs0');
  k.sign(['Sube a los pisos', '2 a 7'], 0.75, 2.6, -3.95, 0, 'floor');
  k.sign(['Paso al Bloque A'], 2.5, 2.4, -11.9, 0, 'ucc');
  k.portal(2.05, -11.9, 2.95, -11.3, 1, 'fromB', 'A');
}
/**
 * Bienestar Universitario (to the right of the Floor 1 hall, as in the video): Bienestar desk,
 * Apoyo Psicosocial, lounge with blue puffs and, at the back, the gym.
 * The entrance is the glass door of the hall (x = 3, z ≈ 1).
 */
function wellbeing(k) {
  // Wall between the service area and the gym, with a free passage next to the door
  k.wall(3, -4, 11, -4, { mat: 'brick', openings: [[0.4, 2.2]] });
  k.sign(['BIENESTAR', 'UNIVERSITARIO'], 2.9, 2.5, 2.2, RIGHT, 'ucc');
  k.sign(['Gimnasio'], 7.5, 2.55, -3.95, 0, 'notice-blue');

  // Bienestar and Apoyo Psicosocial desks (against the back wall, x = 11)
  for (const [z, name] of [[1.6, 'BIENESTAR'], [-2.2, 'APOYO PSICOSOCIAL']]) {
    k.placeObject(desk(), 9.6, z, RIGHT);
    k.placeObject(chair('#2c3e9e'), 8.0, z, LEFT);
    k.sign(name, 9.0, 2.45, z, RIGHT, 'notice-blue');
  }
  k.placeObject(fileCabinet(), 10.6, 2.6, RIGHT);
  k.placeObject(plant(), 3.5, 2.5, 0);

  // Lounge: blue puffs
  for (let i = 0; i < 6; i++) k.placeObject(puff(), 6 + (i % 3) * 1.1, -0.6 - Math.floor(i / 3) * 1.4, i, false);

  // Gym: rubber floor, treadmills against the wall and exercise bikes
  k.box(7.8, 0.02, 7.8, mat('#2b2e31'), 7, 0.01, -8);
  for (let z = -10.8; z <= -5.6; z += 1.3) k.placeObject(treadmill(), 9.8, z, LEFT);
  for (let z = -10.6; z <= -6.2; z += 1.1) k.placeObject(exerciseBike(), 6.8, z, LEFT);
  k.lamps(7, -11, 7, 2, { axis: 'z', passage: 4 });

  k.zone('wellbeing', 3, -4, 11, 3);
  k.zone('gym', 3, -12, 11, -4);
}

function basement2Full(k) {
  basement2(k);
  k.sign(['Paso al Bloque A', 'auditorio'], 9, 2.5, 15.9, PI, 'ucc');
  k.wall(8, 16, 10, 16, { mat: 'brick' });
  k.portal(8, 15.3, 10, 15.9, -1, 'fromB', 'A');
}

/* ======================================================================== Block A */
const stairsA = (up, down) => ({ side: 'left', z0: -4, z1: 4, type: 'stairs', up, down });

const A0 = level({
  id: -1, name: 'Piso 0 · Auditorio (sótano)', short: 'Piso 0', style: 'A', ...A,
  ends: { north: passageB(-2, 'toA') },
  extraDestinations: [{ ...fromB, places: ['Conexión subterránea con el Bloque B'] }],
  rooms: [
    { side: 'left', z0: -22, z1: -4, type: 'auditorium', name: 'Auditorio', sign: ['Auditorio', 'Bloque A'],
      wallColor: '#c9b48f', places: ['Auditorio'], keys: ['auditorio del Bloque A'] },
    stairsA(1, null),
    { side: 'left', z0: 4, z1: 22, type: 'open', zone: 'waiting', name: 'Vestíbulo del auditorio', sign: false },
    { side: 'right', z0: -22, z1: -9, type: 'simulation', name: 'Laboratorio de Simulación Clínica',
      places: ['Laboratorio de Simulación Clínica'], keys: ['simulación clínica'] },
    { side: 'right', z0: -9, z1: 0, type: 'office', name: 'Cuartos técnicos', sign: ['Cuartos técnicos'] },
  ],
});

const A1 = level({
  id: 1, name: 'Piso 1 · Cafetería y Odontología', short: 'Piso 1', style: 'A', ...A, hallwayFloor: 'burgundy',
  ends: { north: passageB(1), south: 'open' },
  extraDestinations: [fromB, { id: 'entrance', name: 'Entrada principal del Bloque A', x: 0, z: 20, yaw: 0 }],
  rooms: [
    { side: 'left', z0: 8, z1: 22, type: 'open', name: 'Cafetería', furniture: cafeteria, isOpen: true,
      places: ['Cafetería'], keys: ['Cafetería', 'restaurante'] },
    { side: 'left', z0: 4, z1: 8, type: 'office', name: 'Papelería', furniture: stationery, places: ['Papelería'], keys: ['papelería', 'fotocopias'] },
    stairsA(2, -1),
    { side: 'left', z0: -10, z1: -4, type: 'faculty', name: 'Facultad de Odontología',
      places: ['Facultad de Odontología'], keys: ['Facultad de Odontología'] },
    { side: 'left', z0: -16, z1: -10, type: 'office', name: 'Coordinación Clínica', places: ['Coordinación Clínica de Odontología'] },
    { side: 'left', z0: -22, z1: -16, type: 'lab', name: 'Laboratorios de Odontología' },
    { side: 'right', z0: 18, z1: 22, type: 'open', name: 'Cajero BBVA', furniture: atm, places: ['Cajero BBVA'], keys: ['cajero', 'BBVA'] },
    { side: 'right', z0: 14, z1: 18, type: 'restrooms', name: 'Baño de mujeres' },
    { side: 'right', z0: 10, z1: 14, type: 'restrooms', name: 'Baño de hombres' },
    { side: 'right', z0: 2, z1: 10, type: 'open', zone: 'lockers', name: 'Lockers del Bloque A', sign: false },
    { side: 'right', z0: -12, z1: 2, type: 'preclinic', name: 'Laboratorio de Preclínica', sign: ['Laboratorio de', 'Preclínica · 114'],
      places: ['Laboratorio de Preclínica'], keys: ['preclínica', 'simulación odontológica'] },
    { side: 'right', z0: -17, z1: -12, type: 'office', name: 'Coordinación de Preclínica' },
    { side: 'right', z0: -22, z1: -17, type: 'office', name: 'Acreditación', sign: ['Acreditación', 'Odontología'] },
  ],
});

const A2 = level({
  id: 2, name: 'Piso 2 · Biblioteca', short: 'Piso 2', style: 'A', ...A,
  rooms: [
    { side: 'left', z0: 15, z1: 22, type: 'office', name: 'Centro de Investigación', places: ['Centro de Investigación'], keys: ['centro de investigación'] },
    { side: 'left', z0: 8, z1: 15, type: 'teachers', name: 'Sala de profesores de Medicina',
      places: ['Sala de profesores de Medicina'], keys: ['profesores de Medicina'] },
    { side: 'left', z0: 4, z1: 8, type: 'restrooms', name: 'Baño de mujeres' },
    stairsA(3, 1),
    { side: 'left', z0: -10, z1: -4, type: 'lab', name: 'Laboratorio de Biología Molecular',
      places: ['Laboratorio de Biología Molecular'], keys: ['biología molecular'] },
    { side: 'left', z0: -16, z1: -10, type: 'computers', name: 'Laboratorio de Realidad Mixta',
      places: ['Laboratorio de Realidad Mixta'], keys: ['realidad mixta'] },
    { side: 'left', z0: -22, z1: -16, type: 'restrooms', name: 'Baño de hombres' },
    { side: 'right', z0: -2, z1: 22, type: 'open', name: 'Biblioteca', furniture: library, isOpen: true,
      places: ['Biblioteca'], keys: ['Biblioteca', 'Bibliotecas Activas'] },
    { side: 'right', z0: -9, z1: -2, type: 'multipurpose', name: 'Laboratorio Multifuncional 1', keys: ['laboratorio multifuncional'] },
    { side: 'right', z0: -16, z1: -9, type: 'multipurpose', name: 'Laboratorio Multifuncional 2' },
    { side: 'right', z0: -22, z1: -16, type: 'multipurpose', name: 'Laboratorio Multifuncional 3' },
  ],
});

const A3 = level({
  id: 3, name: 'Piso 3 · Salas de informática', short: 'Piso 3', style: 'A', ...A,
  ends: { north: passageB(3) },
  extraDestinations: [fromB],
  rooms: [
    { side: 'left', z0: 15, z1: 22, type: 'teachers', name: 'Sala de profesores de Odontología' },
    { side: 'left', z0: 8, z1: 15, type: 'computers', name: 'Sala de Informática 1', places: ['Salas de Informática'], keys: ['sala de informática', 'sala de sistemas', 'computadores'] },
    { side: 'left', z0: 4, z1: 8, type: 'restrooms', name: 'Baño de mujeres' },
    stairsA(4, 2),
    { side: 'left', z0: -10, z1: -4, type: 'computers', name: 'Sala de Informática 2' },
    { side: 'left', z0: -16, z1: -10, type: 'computers', name: 'Sala de Informática 3' },
    { side: 'left', z0: -22, z1: -16, type: 'computers', name: 'Sala de Informática 4' },
    { side: 'right', z0: 6, z1: 22, type: 'open', name: 'Biblioteca (segundo nivel)', furniture: upperLibrary, isOpen: true,
      keys: ['segundo piso de la biblioteca'] },
    { side: 'right', z0: 2, z1: 6, type: 'restrooms', name: 'Baño de hombres' },
    { side: 'right', z0: -10, z1: 2, type: 'computers', name: 'Sala de Informática 5' },
    { side: 'right', z0: -16, z1: -10, type: 'open', zone: 'balcony', name: 'Balcón con vista a Pasto', sign: false, windows: 'bigWindow' },
  ],
});

const A4 = level({
  id: 4, name: 'Piso 4 · Programa de Derecho', short: 'Piso 4', style: 'A', ...A, hallwayFloor: 'burgundy',
  ends: { north: passageB(4) },
  extraDestinations: [fromB],
  rooms: [
    { side: 'left', z0: 12, z1: 22, type: 'office', name: 'Dirección', sign: ['Dirección', 'Campus Pasto'], logo: true },
    { side: 'left', z0: 8, z1: 12, type: 'restrooms', name: 'Baño de mujeres' },
    stairsA(5, 3),
    { side: 'left', z0: -12, z1: -4, type: 'faculty', name: 'Programa de Derecho',
      places: ['Programa de Derecho'], keys: ['programa de Derecho'] },
    { side: 'left', z0: -18, z1: -12, type: 'office', name: 'Centro de Investigaciones Sociojurídicas',
      places: ['Centro de Investigaciones Sociojurídicas'], keys: ['sociojurídicas'] },
    { side: 'left', z0: -22, z1: -18, type: 'restrooms', name: 'Baño de hombres' },
    { side: 'right', z0: 12, z1: 22, type: 'classroom', name: 'Salón de clase', id: 'classroom-a4-1', chair: '#2f8f5a' },
    { side: 'right', z0: 2, z1: 12, type: 'classroom', name: 'Salón de clase', id: 'classroom-a4-2', chair: '#2f8f5a' },
    { side: 'right', z0: -8, z1: 2, type: 'classroom', name: 'Salón de clase', id: 'classroom-a4-3', chair: '#2f8f5a' },
    { side: 'right', z0: -16, z1: -8, type: 'classroom', name: 'Salón de clase', id: 'classroom-a4-4', chair: '#2f8f5a' },
    { side: 'right', z0: -22, z1: -16, type: 'open', zone: 'balcony', name: 'Balcón con vista a Pasto', id: 'balcony-a4', sign: false, windows: 'bigWindow' },
  ],
});

const A5 = level({
  id: 5, name: 'Piso 5 · Open Language Center', short: 'Piso 5', style: 'A', ...A,
  ends: { north: passageB(5) },
  extraDestinations: [fromB],
  rooms: [
    { side: 'left', z0: 10, z1: 22, type: 'faculty', name: 'Open Language Center', sign: ['Open Language Center', 'centro de inglés'],
      places: ['Open Language Center'], keys: ['centro de inglés', 'Open Language', 'inglés'] },
    { side: 'left', z0: 4, z1: 10, type: 'office', name: 'Cuarto de redes', noDestination: true },
    stairsA(6, 4),
    { side: 'left', z0: -10, z1: -4, type: 'classroom', name: 'Salón 501', number: 'A-501' },
    { side: 'left', z0: -16, z1: -10, type: 'classroom', name: 'Salón 503', number: 'A-503' },
    { side: 'left', z0: -22, z1: -16, type: 'classroom', name: 'Salón 518', number: 'A-518' },
    { side: 'right', z0: 12, z1: 22, type: 'computers', name: 'Sala de Informática 6', sign: ['Sala de Informática 6', '504'] },
    { side: 'right', z0: 5, z1: 12, type: 'classroom', name: 'Salón 512', number: 'A-512' },
    { side: 'right', z0: -2, z1: 5, type: 'classroom', name: 'Salón 513', number: 'A-513' },
    { side: 'right', z0: -9, z1: -2, type: 'classroom', name: 'Salón 514', number: 'A-514' },
    { side: 'right', z0: -16, z1: -9, type: 'classroom', name: 'Salón 515', number: 'A-515' },
    { side: 'right', z0: -22, z1: -16, type: 'open', zone: 'balcony', name: 'Balcón con vista a Pasto', id: 'balcony-a5', sign: false, windows: 'bigWindow' },
  ],
});

/* ---------------------------------------------------------------- rooftop with the courts */
const A6 = {
  id: 6, name: 'Piso 6 · Canchas (azotea)', short: 'Piso 6', sky: '#b9d2e8',
  style: { floor: 'reddish', wall: 'brick', lamps: 'tube' },
  destinations: [
    { id: 'stairs0', name: 'Escaleras', x: -3.4, z: 0, yaw: RIGHT },
    { id: 'volleyball', name: 'Cancha de voleibol', x: 4, z: 7, yaw: PI, places: ['Cancha de voleibol'], keys: ['voleibol', 'vóley'] },
    { id: 'turf', name: 'Cancha sintética', x: 4, z: -4, yaw: 0, places: ['Cancha sintética'], keys: ['cancha sintética', 'fútbol'] },
    { id: 'art', name: 'Salón de Arte, Música y Cultura', x: -8.4, z: 7, yaw: LEFT,
      places: ['Salón de Arte, Música y Cultura'], keys: ['arte', 'música', 'cultura'] },
    { id: 'ecological', name: 'Punto ecológico', x: -7.4, z: 12.6, yaw: LEFT },
  ],
  build: rooftop,
};

function rooftop(k) {
  const W = A.W / 2, L = A.L / 2;
  k.setBounds(-W - 0.5, -L - 0.5, W + 0.5, L + 0.5);
  // reddish tile floor and brick parapets, no roof
  k.floorRects.push({ x0: -W, z0: -L, x1: W, z1: L, type: 'reddish', noCeiling: true });
  for (const [ax, az, bx, bz] of [[-W, -L, W, -L], [W, -L, W, L], [W, L, -W, L], [-W, L, -W, -L]])
    k.wall(ax, az, bx, bz, { mat: 'brick', height: 1.15 });
  // stair tower (brick and curved glass) and art room
  k.wall(-W, -4, -4, -4, { mat: 'brick' });
  k.wall(-W, 4, -4, 4, { mat: 'brick' });
  k.staircase(-8.6, -7.0, 3.4, -2.0, 'down', { railings: [true, true] });
  k.portal(-8.6, -1.8, -7.0, -0.4, 5, 'stairs0');
  k.box(W - 4, 0.2, 8, 'concrete', -(W + 4) / 2, HEIGHT + 0.1, 0);
  k.wall(-W, 4, -W, 11);
  k.wall(-W, 11, -6, 11, { mat: 'brick' });
  k.wall(-6, 4, -6, 11, { mat: 'brick', openings: [[2.4, 3.5]] });
  k.door(-6, 7, PI, { color: 'orangeDoor', isOpen: false });
  k.sign(['Salón de Arte,', 'Música y Cultura'], -5.9, 1.9, 7.9, LEFT, 'floor');
  k.box(W - 6, 0.2, 7, 'concrete', -(W + 6) / 2, HEIGHT + 0.1, 7.5);
  k.placeObject(bins(['#2e7d32', '#9e9e9e', '#1565c0', '#f9a825']), -9.5, 12.6, LEFT);
  k.label('Punto ecológico', -9.5, 1.6, 12.6);
  k.label('Cuarto técnico', -9.5, 2.2, 16.5);
  k.box(4, 2.6, 3, 'concrete', -9.5, 1.3, 17.5);
  k.obstacle(-11.5, 16, -7.5, 19);
  // courts with fences
  court(k, 4, 10, 12, 8, '#c96f43', 'volleyball');
  court(k, 4, -11.5, 14, 19, '#3e9b4f', 'turf');
  k.label('Cancha de voleibol', 4, 3.2, 10);
  k.label('Cancha sintética', 4, 3.6, -11.5);
}

function court(k, x, z, w, d, color, type) {
  const floor = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), mat(color));
  floor.position.set(x, 0.015, z);
  k.add(floor);
  const line = (lw, ld, lx, lz) => { const l = new THREE.Mesh(new THREE.BoxGeometry(lw, 0.035, ld), mat('#f5f5f5')); l.position.set(x + lx, 0.02, z + lz); k.add(l); };
  line(w - 1, 0.08, 0, -d / 2 + 0.5); line(w - 1, 0.08, 0, d / 2 - 0.5);
  line(0.08, d - 1, -w / 2 + 0.5, 0); line(0.08, d - 1, w / 2 - 0.5, 0);
  line(w - 1, 0.08, 0, 0);
  if (type === 'volleyball') {
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 8), mat('steel')); p.position.set(x + sx * (w / 2 - 0.3), 1.25, z); k.add(p); }
    const net = new THREE.Mesh(new THREE.BoxGeometry(w - 0.6, 0.9, 0.02), mat('#202326')); net.material = new THREE.MeshStandardMaterial({ color: '#202326', transparent: true, opacity: 0.5 });
    net.position.set(x, 2.0, z); k.add(net);
  } else {
    for (const sz of [-1, 1]) {           // goals
      const arch = new THREE.Group();
      for (const sx of [-1.5, 1.5]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2, 0.08), mat('#f5f5f5')); p.position.set(sx, 1, 0); arch.add(p); }
      const t = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.08, 0.08), mat('#f5f5f5')); t.position.y = 2; arch.add(t);
      arch.position.set(x, 0, z + sz * (d / 2 - 0.4)); k.add(arch);
    }
  }
  // perimeter fence (you can see through it)
  const fence = new THREE.MeshStandardMaterial({ color: '#4a4f54', transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false });
  const height = type === 'volleyball' ? 3.5 : 5;
  for (const [mx, mz, mw, md] of [[0, -d / 2, w, 0.02], [0, d / 2, w, 0.02], [-w / 2, 0, 0.02, d], [w / 2, 0, 0.02, d]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(mw, height, md), fence); m.position.set(x + mx, height / 2, z + mz); k.add(m);
  }
  for (let px = -w / 2; px <= w / 2 + 0.01; px += w / 4)
    for (const pz of [-d / 2, d / 2]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, height, 6), mat('#4a4f54')); p.position.set(x + px, height / 2, z + pz); k.add(p); }
  // The court can be walked inside; the fence has a door in front of the corridor
  k.walls.push({ ax: x - w / 2, az: z - d / 2, bx: x - w / 2, bz: z + d / 2 });
  k.walls.push({ ax: x + w / 2, az: z - d / 2, bx: x + w / 2, bz: z + d / 2 });
  const far = z > 0 ? z + d / 2 : z - d / 2;
  k.walls.push({ ax: x - w / 2, az: far, bx: x + w / 2, bz: far });
}

/* ======================================================================== Furniture of block A */
function cafeteria(k, g, s) {
  // Food counter against the outer wall, with shops (as in the video) and tables in the rest
  k.placeObject(cafeteriaCounter(Math.min(10, g.length - 3)), g.xe - g.sg * 0.8, g.cz, g.sg > 0 ? RIGHT : LEFT);
  k.image(textureMenu(), 4.2, 1.6, g.xe - g.sg * 0.1, 2.15, g.cz, g.sg > 0 ? RIGHT : LEFT);
  k.placeObject(fridge('#c62828'), g.xe - g.sg * 0.5, s.z1 - 1.0, g.sg > 0 ? RIGHT : LEFT);
  k.placeObject(fridge('#1565c0'), g.xe - g.sg * 0.5, s.z1 - 2.1, g.sg > 0 ? RIGHT : LEFT);
  k.placeObject(cashRegister(), g.xe - g.sg * 2.2, s.z0 + 1.4, g.sg > 0 ? RIGHT : LEFT);
  for (const x of [s.z0 + 0.8]) k.placeObject(microwave(), g.xe - g.sg * 0.4, x, 0, false, 0.78);
  for (let z = s.z0 + 1.6; z < s.z1 - 1.2; z += 2.1)
    for (let x = Math.min(g.xi, g.xe) + 1.2; x < Math.max(g.xi, g.xe) - 3.2; x += 2.1) {
      k.placeObject(woodTable(1.1, 0.75, '#d0b48a'), x, z, 0);
      for (const [dx, dz, r] of [[-0.3, 0.6, PI], [0.3, 0.6, PI], [-0.3, -0.6, 0], [0.3, -0.6, 0]])
        k.placeObject(chair('#f2f2f2', 'plastic'), x + dx, z + dz, r, false);
    }
  // colored panels hanging from the ceiling
  const colors = ['#f9c74f', '#2a9fd6', '#8ac926', '#ef476f'];
  for (let i = 0, z = s.z0 + 1.5; z < s.z1 - 1; z += 2.6, i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.04, 0.9), mat(colors[i % 4]));
    p.position.set(g.cx, HEIGHT - 0.35, z); p.rotation.y = 0.3 * (i % 2 ? 1 : -1);
    k.add(p);
  }
  k.sign(['CAFETERÍA'], g.cx, 2.6, s.z0 + 0.1, 0, 'notice-dark');
}

function stationery(k, g, s) {
  k.placeObject(glassCounter(g.length - 1.2), g.cx, g.cz, g.sg > 0 ? RIGHT : LEFT);
  k.placeObject(shelf(g.length - 1, 2.0, 'supplies'), g.xe - g.sg * 0.3, g.cz, g.sg > 0 ? RIGHT : LEFT);
}

function atm(k, g, s) {
  const c = new THREE.Group();
  box(c, 0.8, 1.7, 0.7, '#1f3c88', 0, 0.85, 0);
  box(c, 0.5, 0.35, 0.02, '#0b1220', 0, 1.3, 0.36);
  box(c, 0.8, 0.25, 0.72, '#0f2a66', 0, 1.82, 0);
  k.placeObject(c, g.xe - g.sg * 0.6, g.cz, g.sg > 0 ? RIGHT : LEFT);
  k.sign(['BBVA'], g.xe - g.sg * 0.1, 2.4, g.cz, g.sg > 0 ? RIGHT : LEFT, 'notice-blue');
}

function library(k, g, s) {
  // Glass facade with the "Bibliotecas Activas" sign and a double height with a turquoise staircase
  k.glassWall(g.xi, s.z0, g.xi, s.z1, { openings: [[s.z1 - s.z0 - 6, s.z1 - s.z0 - 4]] });
  k.sign(['Bibliotecas Activas', 'conoce, aprende y disfruta'], g.xi - g.sg * 0.1, 2.6, s.z1 - 5, g.sg > 0 ? RIGHT : LEFT, 'notice');
  k.placeObject(libraryDesk(), g.xi + g.sg * 2.2, s.z1 - 3.5, g.sg > 0 ? LEFT : RIGHT);
  for (let z = s.z0 + 1.2; z < s.z1 - 6; z += 1.6)
    k.placeObject(shelf(4.2, 2.1, 'libros'), g.xe - g.sg * 2.6, z, 0);
  for (let z = s.z0 + 2; z < s.z1 - 7; z += 2.8)
    for (const dx of [2.2, 4.6]) {
      k.placeObject(woodTable(1.6, 0.9, '#c9a571'), g.xi + g.sg * dx, z, 0);
      for (const [ex, ez, r] of [[-0.4, 0.7, PI], [0.4, 0.7, PI], [-0.4, -0.7, 0], [0.4, -0.7, 0]])
        k.placeObject(chair('#3d5a99'), g.xi + g.sg * dx + ex, z + ez, r, false);
    }
  for (const z of [s.z1 - 1.2, s.z1 - 2.2]) k.placeObject(sofa('#159a9c'), g.xe - g.sg * 1.2, z, g.sg > 0 ? RIGHT : LEFT);
  k.placeObject(turquoiseStair(), g.xe - g.sg * 0.9, s.z0 + 4, 0, true);
  k.placeObject(lockers({ cols: 6, rows: 5, type: 'glass' }), g.xi + g.sg * 0.5, s.z1 - 1.2, g.sg > 0 ? RIGHT : LEFT);
}

function upperLibrary(k, g, s) {
  k.glassWall(g.xi, s.z0, g.xi, s.z1, { openings: [[s.z1 - s.z0 - 3, s.z1 - s.z0 - 1]] });
  k.sign(['Biblioteca', 'segundo nivel'], g.xi - g.sg * 0.1, 2.6, s.z1 - 2, g.sg > 0 ? RIGHT : LEFT, 'notice');
  for (let z = s.z0 + 1.2; z < s.z1 - 4; z += 2.4) {
    k.placeObject(woodTable(2.4, 1.0, '#c9a571'), g.cx, z, 0);
    for (const dx of [-0.8, 0, 0.8]) for (const [dz, r] of [[0.75, PI], [-0.75, 0]]) k.placeObject(chair('#7a8794'), g.cx + dx, z + dz, r, false);
  }
  k.placeObject(railing(g.length - 2), g.xe - g.sg * 2.5, g.cz, LEFT, true);
}

function glassCounter(w) {
  const g = new THREE.Group();
  box(g, w, 0.9, 0.55, '#d8d2c8', 0, 0.45, 0);
  box(g, w, 0.35, 0.55, 'glass', 0, 1.08, 0);
  return g;
}
function libraryDesk() {
  const g = new THREE.Group();
  box(g, 3.2, 1.05, 0.8, '#b6d68a', 0, 0.52, 0);
  box(g, 3.3, 0.05, 0.9, '#8d6e4f', 0, 1.07, 0);
  box(g, 0.5, 0.32, 0.03, 'black', -0.6, 1.3, 0.1);
  return g;
}
function sofa(color) {
  const g = new THREE.Group();
  box(g, 1.6, 0.45, 0.8, color, 0, 0.23, 0);
  box(g, 1.6, 0.5, 0.18, color, 0, 0.6, -0.31);
  return g;
}
function turquoiseStair() {
  const g = new THREE.Group();
  for (let i = 0; i < 12; i++) box(g, 1.1, 0.06, 0.32, '#8b5a33', 0, 0.25 + i * 0.25, -i * 0.28);
  for (const x of [-0.6, 0.6]) {
    const r = box(g, 0.05, 0.05, 4.3, '#1d8f9a', x, 2.3, -1.55);
    r.rotation.x = Math.atan2(3, 3.3);
  }
  box(g, 0.12, 3.0, 0.12, '#1d8f9a', 0, 1.5, -3.1);
  return g;
}
function railing(L) {
  const g = new THREE.Group();
  box(g, L, 0.05, 0.05, 'frame', 0, 1.05, 0);
  for (let x = -L / 2; x <= L / 2; x += 1.2) box(g, 0.04, 1.05, 0.04, 'frame', x, 0.52, 0);
  box(g, L, 1.0, 0.02, 'glass', 0, 0.55, 0);
  return g;
}

/* ======================================================================== Exports */
export function levelsB(base) {
  const [n1, n0, s2] = base;
  n1.build = floor1Full;
  n1.destinations = [...n1.destinations.filter(d => d.id !== 'stairs'),
    { id: 'wellbeing', name: 'Bienestar Universitario · Apoyo Psicosocial', x: 4.4, z: 1.0, yaw: RIGHT, approximate: true,
      places: ['Bienestar Universitario', 'Apoyo Psicosocial', 'Zona de descanso con puffs'],
      keys: ['Bienestar', 'Psicosocial', 'puffs'] },
    { id: 'gym', name: 'Gimnasio', x: 4.6, z: -6.5, yaw: RIGHT, approximate: true, places: ['Gimnasio'], keys: ['gimnasio'] },
    { id: 'stairs', name: 'Escaleras (sube y baja)', x: 0.75, z: -2.6, yaw: 0 },
    { id: 'stairs0', name: 'Llegada desde el Piso 2', x: 0.75, z: -2.8, yaw: PI, hidden: true },
    { id: 'fromA', name: 'Paso al Bloque A', x: 2.5, z: -10.4, yaw: PI, hidden: true }];
  s2.build = basement2Full;
  s2.destinations = [...s2.destinations, { id: 'toA', name: 'Paso al Bloque A (sótano)', x: 7.5, z: 14.2, yaw: 0, hidden: true,
    places: ['Conexión subterránea con el Bloque A'] }];
  return [B7, B6, B5, B4, B3, B2, n1, n0, s2];
}

export const levelsA = [A6, A5, A4, A3, A2, A1, A0];
export { levelName };
