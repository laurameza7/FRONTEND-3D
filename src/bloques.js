import * as THREE from 'three';
import { ALTO, mat } from './recorrido.js';
import { nivel, nombreNivel } from './pisos.js';
import {
  piso1, piso0, sotano2, barraCafeteria, caja1, nevera, microondas, texturaMenu, caja, cilindro,
  estanteria, mesaMadera, silla, planta, canecas, lockers, banca, texturaLogoUcc,
} from './planos.js';

/*
 * Pisos de los bloques A y B tal como se ven y se narran en los videos del campus.
 * Bloque B: 22 m × 30 m, 7 pisos y sótanos. Bloque A: 24 m × 44 m, 6 pisos (canchas en la azotea) y sótano.
 * Los pasos entre bloques (pisos 1, 3, 4 y 5, y los sótanos) llevan de un bloque al otro.
 */

const PI = Math.PI, DER = -PI / 2, IZQ = PI / 2;
const B = { W: 22, L: 30 }, A = { W: 24, L: 44, P: 3.2 };

// Llegadas al cruzar un paso entre bloques
const desdeA = { id: 'desdeA', nombre: 'Paso al Bloque A', x: 0, z: -B.L / 2 + 2, yaw: PI, oculto: true };
const desdeB = { id: 'desdeB', nombre: 'Paso al Bloque B', x: 0, z: -A.L / 2 + 2, yaw: PI, oculto: true };
const pasoA = (n, llegada = 'desdeB') => ({ conexion: 'Bloque A', edificio: 'A', nivel: n, llegada });
const pasoB = (n, llegada = 'desdeA') => ({ conexion: 'Bloque B', edificio: 'B', nivel: n, llegada });

/* ======================================================================== Bloque B */
const escB = (sube, baja) => ({ lado: 'izq', z0: -3, z1: 4.5, tipo: 'escaleras', sube, baja });

const B2 = nivel({
  id: 2, nombre: 'Piso 2 · Salones', corto: 'Piso 2', estilo: 'B', ...B,
  salas: [
    { lado: 'izq', z0: -15, z1: -9, tipo: 'salon', nombre: 'Salón 301', numero: '301' },
    { lado: 'izq', z0: -9, z1: -3, tipo: 'salon', nombre: 'Salón 302', numero: '302' },
    escB(3, 1),
    { lado: 'izq', z0: 4.5, z1: 9.75, tipo: 'salon', nombre: 'Salón 303', numero: '303' },
    { lado: 'izq', z0: 9.75, z1: 15, tipo: 'salon', nombre: 'Salón 304', numero: '304' },
    { lado: 'der', z0: -15, z1: -6, tipo: 'salon', nombre: 'Salón 305', numero: '305',
      nota: 'Así son los salones de la Universidad Cooperativa: sillas universitarias, tablero y proyector.' },
    { lado: 'der', z0: -6, z1: 2, tipo: 'abierto', zona: 'espera', nombre: 'Zona de espera', letrero: false },
  ],
});

const B3 = nivel({
  id: 3, nombre: 'Piso 3 · Facultad de Medicina', corto: 'Piso 3', estilo: 'B', ...B,
  extremos: { norte: pasoA(3) },
  destinosExtra: [desdeA],
  salas: [
    { lado: 'izq', z0: -15, z1: -8, tipo: 'facultad', nombre: 'Facultad de Medicina',
      lugares: ['Facultad de Medicina'], claves: ['Facultad de Medicina', 'decanatura de Medicina'] },
    { lado: 'izq', z0: -8, z1: -3, tipo: 'oficina', nombre: 'Coordinación del programa de Medicina',
      lugares: ['Coordinación del programa de Medicina'], claves: ['coordinación de Medicina'] },
    escB(4, 2),
    { lado: 'izq', z0: 4.5, z1: 15, tipo: 'salon', nombre: 'Salón de Medicina', numero: 'Medicina' },
    { lado: 'der', z0: -15, z1: -7, tipo: 'oficina', nombre: 'Oficinas de la Facultad de Medicina', logo: true },
    { lado: 'der', z0: -7, z1: 4, tipo: 'salon', nombre: 'Salón de clase', id: 'salon-b3-1' },
    { lado: 'der', z0: 4, z1: 15, tipo: 'salon', nombre: 'Salón de clase', id: 'salon-b3-2' },
  ],
});

const B4 = nivel({
  id: 4, nombre: 'Piso 4 · Facultad de Ingeniería', corto: 'Piso 4', estilo: 'B', ...B,
  extremos: { norte: pasoA(4) },
  destinosExtra: [desdeA],
  salas: [
    { lado: 'izq', z0: -15, z1: -9.5, tipo: 'salon', nombre: 'Salón 401', numero: '401' },
    { lado: 'izq', z0: -9.5, z1: -3, tipo: 'salon', nombre: 'Salón 402', numero: '402' },
    escB(5, 3),
    { lado: 'izq', z0: 4.5, z1: 9.5, tipo: 'profesores', nombre: 'Sala de profesores de Ingeniería', letrero: ['Sala de profesores', '409'],
      lugares: ['Sala de profesores de Ingeniería'], claves: ['sala de profesores de Ingeniería', '409'] },
    { lado: 'izq', z0: 9.5, z1: 15, tipo: 'salon', nombre: 'Salón 410', numero: '410' },
    { lado: 'der', z0: -15, z1: -8.5, tipo: 'facultad', nombre: 'Facultad de Ingeniería',
      letrero: ['Facultad de Ingeniería', 'decanatura'],
      lugares: ['Facultad de Ingeniería'], claves: ['Facultad de Ingeniería', 'decanatura de Ingeniería', 'Ingeniería de Software'] },
    { lado: 'der', z0: -8.5, z1: -2.5, tipo: 'lab', nombre: 'Laboratorio de Aplicaciones de la Física',
      lugares: ['Laboratorios de Ingeniería Industrial'], claves: ['laboratorio de física', 'Ingeniería Industrial'] },
    { lado: 'der', z0: -2.5, z1: 3.5, tipo: 'lab', nombre: 'Laboratorio de Aplicaciones de la Química', claves: ['laboratorio de química'] },
    { lado: 'der', z0: 3.5, z1: 9.5, tipo: 'lab', nombre: 'Laboratorio de Bioprocesos y Biotecnología', claves: ['bioprocesos', 'biotecnología'] },
    { lado: 'der', z0: 9.5, z1: 15, tipo: 'audiencias', nombre: 'Salas de audiencia de Derecho',
      lugares: ['Salas de audiencia de Derecho'], claves: ['salas de audiencia'] },
  ],
});

const B5 = nivel({
  id: 5, nombre: 'Piso 5 · Enfermería y Derecho', corto: 'Piso 5', estilo: 'B', ...B,
  extremos: { norte: pasoA(5) },
  destinosExtra: [desdeA],
  salas: [
    { lado: 'izq', z0: -15, z1: -9, tipo: 'facultad', nombre: 'Facultad de Enfermería', letrero: ['Facultad de Enfermería', '501'],
      lugares: ['Facultad de Enfermería'], claves: ['Facultad de Enfermería', 'programa de Enfermería'] },
    { lado: 'izq', z0: -9, z1: -3, tipo: 'profesores', nombre: 'Sala de profesores de Enfermería' },
    escB(6, 4),
    { lado: 'izq', z0: 4.5, z1: 9.75, tipo: 'salon', nombre: 'Salón 502', numero: '502' },
    { lado: 'izq', z0: 9.75, z1: 15, tipo: 'salon', nombre: 'Salón 503', numero: '503' },
    { lado: 'der', z0: -15, z1: -8, tipo: 'facultad', nombre: 'Facultad de Derecho',
      lugares: ['Facultad de Derecho'], claves: ['Facultad de Derecho'] },
    { lado: 'der', z0: -8, z1: -2, tipo: 'salon', nombre: 'Salón 504', numero: '504' },
    { lado: 'der', z0: -2, z1: 4, tipo: 'salon', nombre: 'Salón 505', numero: '505' },
    { lado: 'der', z0: 4, z1: 9.5, tipo: 'salon', nombre: 'Salón 506', numero: '506' },
    { lado: 'der', z0: 9.5, z1: 15, tipo: 'salon', nombre: 'Salón 508', numero: '508' },
  ],
});

const B6 = nivel({
  id: 6, nombre: 'Piso 6 · Laboratorios', corto: 'Piso 6', estilo: 'Balto', ...B,
  salas: [
    { lado: 'izq', z0: -15, z1: -9, tipo: 'salon', nombre: 'Salón 601', numero: '601' },
    { lado: 'izq', z0: -9, z1: -3, tipo: 'salon', nombre: 'Salón 602', numero: '602' },
    escB(7, 5),
    { lado: 'izq', z0: 4.5, z1: 15, tipo: 'operaciones', nombre: 'Laboratorio de Operaciones',
      lugares: ['Laboratorio de Operaciones'], claves: ['laboratorio de operaciones'] },
    { lado: 'der', z0: -15, z1: -4, tipo: 'innovacion', nombre: 'Laboratorio de Innovación, Prototipado y Emprendimiento',
      letrero: ['Laboratorio de Innovación,', 'Prototipado y Emprendimiento · 605'],
      lugares: ['Laboratorio de Innovación, Prototipado y Emprendimiento'], claves: ['laboratorio de innovación', 'impresoras 3D', '605'] },
    { lado: 'der', z0: -4, z1: 4, tipo: 'abierto', zona: 'espera', nombre: 'Zona de espera del piso 6', letrero: false },
  ],
});

const B7 = nivel({
  id: 7, nombre: 'Piso 7 · Auditorio Urcunina', corto: 'Piso 7', estilo: 'Balto', ...B,
  salas: [
    { lado: 'izq', z0: -15, z1: -3, tipo: 'auditorio', nombre: 'Auditorio Urcunina', letrero: ['Auditorio Urcunina', 'aula 611'],
      muroColor: '#d8a943', lugares: ['Auditorio Urcunina'], claves: ['Urcunina', 'aula 611'] },
    escB(null, 6),
    { lado: 'izq', z0: 4.5, z1: 15, tipo: 'salon', nombre: 'Salón 608', numero: '608' },
    { lado: 'der', z0: -15, z1: 1, tipo: 'salon', nombre: 'Salón 610', numero: '610', nota: 'Salón muy grande con ventanales.' },
    { lado: 'der', z0: 1, z1: 8, tipo: 'abierto', zona: 'backing', nombre: 'Muro de fotos UCC', letrero: false },
  ],
});

/** Piso 1 del B (hecho a partir de las fotos) + escalera al Piso 2 y paso al Bloque A. */
function piso1Completo(k) {
  piso1(k);
  k.obstaculos = k.obstaculos.filter(o => !(o.x0 === -0.5 && o.z0 === -11.5));   // ya se puede subir
  k.portal(-0.5, -11.4, 2.0, -9.9, 2, 'esc0');
  k.letrero(['Sube a los pisos', '2 a 7'], 0.75, 2.6, -3.95, 0, 'piso');
  k.letrero(['Paso al Bloque A'], 2.5, 2.4, -11.9, 0, 'ucc');
  k.portal(2.05, -11.9, 2.95, -11.3, 1, 'desdeB', 'A');
}
function sotano2Completo(k) {
  sotano2(k);
  k.letrero(['Paso al Bloque A', 'auditorio'], 9, 2.5, 15.9, PI, 'ucc');
  k.muro(8, 16, 10, 16, { mat: 'ladrillo' });
  k.portal(8, 15.3, 10, 15.9, -1, 'desdeB', 'A');
}

/* ======================================================================== Bloque A */
const escA = (sube, baja) => ({ lado: 'izq', z0: -4, z1: 4, tipo: 'escaleras', sube, baja });

const A0 = nivel({
  id: -1, nombre: 'Piso 0 · Auditorio (sótano)', corto: 'Piso 0', estilo: 'A', ...A,
  extremos: { norte: pasoB(-2, 'paraA') },
  destinosExtra: [desdeB],
  salas: [
    { lado: 'izq', z0: -22, z1: -4, tipo: 'auditorio', nombre: 'Auditorio', letrero: ['Auditorio', 'Bloque A'],
      muroColor: '#c9b48f', lugares: ['Auditorio'], claves: ['auditorio del Bloque A'] },
    escA(1, null),
    { lado: 'izq', z0: 4, z1: 22, tipo: 'abierto', zona: 'espera', nombre: 'Vestíbulo del auditorio', letrero: false },
    { lado: 'der', z0: -22, z1: -9, tipo: 'simulacion', nombre: 'Laboratorio de Simulación Clínica',
      lugares: ['Laboratorio de Simulación Clínica'], claves: ['simulación clínica'] },
    { lado: 'der', z0: -9, z1: 0, tipo: 'oficina', nombre: 'Cuartos técnicos', letrero: ['Cuartos técnicos'] },
  ],
});

const A1 = nivel({
  id: 1, nombre: 'Piso 1 · Cafetería y Odontología', corto: 'Piso 1', estilo: 'A', ...A, pisoPasillo: 'vinotinto',
  extremos: { norte: pasoB(1), sur: 'abierto' },
  destinosExtra: [desdeB, { id: 'entrada', nombre: 'Entrada principal del Bloque A', x: 0, z: 20, yaw: 0 }],
  salas: [
    { lado: 'izq', z0: 8, z1: 22, tipo: 'abierto', nombre: 'Cafetería', muebles: cafeteria, abierta: true,
      lugares: ['Cafetería'], claves: ['Cafetería', 'restaurante'] },
    { lado: 'izq', z0: 4, z1: 8, tipo: 'oficina', nombre: 'Papelería', muebles: papeleria, lugares: ['Papelería'], claves: ['papelería', 'fotocopias'] },
    escA(2, -1),
    { lado: 'izq', z0: -10, z1: -4, tipo: 'facultad', nombre: 'Facultad de Odontología',
      lugares: ['Facultad de Odontología'], claves: ['Facultad de Odontología'] },
    { lado: 'izq', z0: -16, z1: -10, tipo: 'oficina', nombre: 'Coordinación Clínica', lugares: ['Coordinación Clínica de Odontología'] },
    { lado: 'izq', z0: -22, z1: -16, tipo: 'lab', nombre: 'Laboratorios de Odontología' },
    { lado: 'der', z0: 18, z1: 22, tipo: 'abierto', nombre: 'Cajero BBVA', muebles: cajero, lugares: ['Cajero BBVA'], claves: ['cajero', 'BBVA'] },
    { lado: 'der', z0: 14, z1: 18, tipo: 'banos', nombre: 'Baño de mujeres' },
    { lado: 'der', z0: 10, z1: 14, tipo: 'banos', nombre: 'Baño de hombres' },
    { lado: 'der', z0: 2, z1: 10, tipo: 'abierto', zona: 'lockers', nombre: 'Lockers del Bloque A', letrero: false },
    { lado: 'der', z0: -12, z1: 2, tipo: 'preclinica', nombre: 'Laboratorio de Preclínica', letrero: ['Laboratorio de', 'Preclínica · 114'],
      lugares: ['Laboratorio de Preclínica'], claves: ['preclínica', 'simulación odontológica'] },
    { lado: 'der', z0: -17, z1: -12, tipo: 'oficina', nombre: 'Coordinación de Preclínica' },
    { lado: 'der', z0: -22, z1: -17, tipo: 'oficina', nombre: 'Acreditación', letrero: ['Acreditación', 'Odontología'] },
  ],
});

const A2 = nivel({
  id: 2, nombre: 'Piso 2 · Biblioteca', corto: 'Piso 2', estilo: 'A', ...A,
  salas: [
    { lado: 'izq', z0: 15, z1: 22, tipo: 'oficina', nombre: 'Centro de Investigación', lugares: ['Centro de Investigación'], claves: ['centro de investigación'] },
    { lado: 'izq', z0: 8, z1: 15, tipo: 'profesores', nombre: 'Sala de profesores de Medicina',
      lugares: ['Sala de profesores de Medicina'], claves: ['profesores de Medicina'] },
    { lado: 'izq', z0: 4, z1: 8, tipo: 'banos', nombre: 'Baño de mujeres' },
    escA(3, 1),
    { lado: 'izq', z0: -10, z1: -4, tipo: 'lab', nombre: 'Laboratorio de Biología Molecular',
      lugares: ['Laboratorio de Biología Molecular'], claves: ['biología molecular'] },
    { lado: 'izq', z0: -16, z1: -10, tipo: 'informatica', nombre: 'Laboratorio de Realidad Mixta',
      lugares: ['Laboratorio de Realidad Mixta'], claves: ['realidad mixta'] },
    { lado: 'izq', z0: -22, z1: -16, tipo: 'banos', nombre: 'Baño de hombres' },
    { lado: 'der', z0: -2, z1: 22, tipo: 'abierto', nombre: 'Biblioteca', muebles: biblioteca, abierta: true,
      lugares: ['Biblioteca'], claves: ['Biblioteca', 'Bibliotecas Activas'] },
    { lado: 'der', z0: -9, z1: -2, tipo: 'multifuncional', nombre: 'Laboratorio Multifuncional 1', claves: ['laboratorio multifuncional'] },
    { lado: 'der', z0: -16, z1: -9, tipo: 'multifuncional', nombre: 'Laboratorio Multifuncional 2' },
    { lado: 'der', z0: -22, z1: -16, tipo: 'multifuncional', nombre: 'Laboratorio Multifuncional 3' },
  ],
});

const A3 = nivel({
  id: 3, nombre: 'Piso 3 · Salas de informática', corto: 'Piso 3', estilo: 'A', ...A,
  extremos: { norte: pasoB(3) },
  destinosExtra: [desdeB],
  salas: [
    { lado: 'izq', z0: 15, z1: 22, tipo: 'profesores', nombre: 'Sala de profesores de Odontología' },
    { lado: 'izq', z0: 8, z1: 15, tipo: 'informatica', nombre: 'Sala de Informática 1', lugares: ['Salas de Informática'], claves: ['sala de informática', 'sala de sistemas', 'computadores'] },
    { lado: 'izq', z0: 4, z1: 8, tipo: 'banos', nombre: 'Baño de mujeres' },
    escA(4, 2),
    { lado: 'izq', z0: -10, z1: -4, tipo: 'informatica', nombre: 'Sala de Informática 2' },
    { lado: 'izq', z0: -16, z1: -10, tipo: 'informatica', nombre: 'Sala de Informática 3' },
    { lado: 'izq', z0: -22, z1: -16, tipo: 'informatica', nombre: 'Sala de Informática 4' },
    { lado: 'der', z0: 6, z1: 22, tipo: 'abierto', nombre: 'Biblioteca (segundo nivel)', muebles: bibliotecaAlta, abierta: true,
      claves: ['segundo piso de la biblioteca'] },
    { lado: 'der', z0: 2, z1: 6, tipo: 'banos', nombre: 'Baño de hombres' },
    { lado: 'der', z0: -10, z1: 2, tipo: 'informatica', nombre: 'Sala de Informática 5' },
    { lado: 'der', z0: -16, z1: -10, tipo: 'abierto', zona: 'balcon', nombre: 'Balcón con vista a Pasto', letrero: false, ventanas: 'ventanal' },
  ],
});

const A4 = nivel({
  id: 4, nombre: 'Piso 4 · Programa de Derecho', corto: 'Piso 4', estilo: 'A', ...A, pisoPasillo: 'vinotinto',
  extremos: { norte: pasoB(4) },
  destinosExtra: [desdeB],
  salas: [
    { lado: 'izq', z0: 12, z1: 22, tipo: 'oficina', nombre: 'Dirección', letrero: ['Dirección', 'Campus Pasto'], logo: true },
    { lado: 'izq', z0: 8, z1: 12, tipo: 'banos', nombre: 'Baño de mujeres' },
    escA(5, 3),
    { lado: 'izq', z0: -12, z1: -4, tipo: 'facultad', nombre: 'Programa de Derecho',
      lugares: ['Programa de Derecho'], claves: ['programa de Derecho'] },
    { lado: 'izq', z0: -18, z1: -12, tipo: 'oficina', nombre: 'Centro de Investigaciones Sociojurídicas',
      lugares: ['Centro de Investigaciones Sociojurídicas'], claves: ['sociojurídicas'] },
    { lado: 'izq', z0: -22, z1: -18, tipo: 'banos', nombre: 'Baño de hombres' },
    { lado: 'der', z0: 12, z1: 22, tipo: 'salon', nombre: 'Salón de clase', id: 'salon-a4-1', silla: '#2f8f5a' },
    { lado: 'der', z0: 2, z1: 12, tipo: 'salon', nombre: 'Salón de clase', id: 'salon-a4-2', silla: '#2f8f5a' },
    { lado: 'der', z0: -8, z1: 2, tipo: 'salon', nombre: 'Salón de clase', id: 'salon-a4-3', silla: '#2f8f5a' },
    { lado: 'der', z0: -16, z1: -8, tipo: 'salon', nombre: 'Salón de clase', id: 'salon-a4-4', silla: '#2f8f5a' },
    { lado: 'der', z0: -22, z1: -16, tipo: 'abierto', zona: 'balcon', nombre: 'Balcón con vista a Pasto', id: 'balcon-a4', letrero: false, ventanas: 'ventanal' },
  ],
});

const A5 = nivel({
  id: 5, nombre: 'Piso 5 · Open Language Center', corto: 'Piso 5', estilo: 'A', ...A,
  extremos: { norte: pasoB(5) },
  destinosExtra: [desdeB],
  salas: [
    { lado: 'izq', z0: 10, z1: 22, tipo: 'facultad', nombre: 'Open Language Center', letrero: ['Open Language Center', 'centro de inglés'],
      lugares: ['Open Language Center'], claves: ['centro de inglés', 'Open Language', 'inglés'] },
    { lado: 'izq', z0: 4, z1: 10, tipo: 'oficina', nombre: 'Cuarto de redes', sinDestino: true },
    escA(6, 4),
    { lado: 'izq', z0: -10, z1: -4, tipo: 'salon', nombre: 'Salón 501', numero: 'A-501' },
    { lado: 'izq', z0: -16, z1: -10, tipo: 'salon', nombre: 'Salón 503', numero: 'A-503' },
    { lado: 'izq', z0: -22, z1: -16, tipo: 'salon', nombre: 'Salón 518', numero: 'A-518' },
    { lado: 'der', z0: 12, z1: 22, tipo: 'informatica', nombre: 'Sala de Informática 6', letrero: ['Sala de Informática 6', '504'] },
    { lado: 'der', z0: 5, z1: 12, tipo: 'salon', nombre: 'Salón 512', numero: 'A-512' },
    { lado: 'der', z0: -2, z1: 5, tipo: 'salon', nombre: 'Salón 513', numero: 'A-513' },
    { lado: 'der', z0: -9, z1: -2, tipo: 'salon', nombre: 'Salón 514', numero: 'A-514' },
    { lado: 'der', z0: -16, z1: -9, tipo: 'salon', nombre: 'Salón 515', numero: 'A-515' },
    { lado: 'der', z0: -22, z1: -16, tipo: 'abierto', zona: 'balcon', nombre: 'Balcón con vista a Pasto', id: 'balcon-a5', letrero: false, ventanas: 'ventanal' },
  ],
});

/* ---------------------------------------------------------------- azotea con las canchas */
const A6 = {
  id: 6, nombre: 'Piso 6 · Canchas (azotea)', corto: 'Piso 6', cielo: '#b9d2e8',
  estilo: { piso: 'rojizo', muro: 'ladrillo', lamparas: 'tubo' },
  destinos: [
    { id: 'esc0', nombre: 'Escaleras', x: -3.4, z: 0, yaw: DER },
    { id: 'voleibol', nombre: 'Cancha de voleibol', x: 4, z: 7, yaw: PI, lugares: ['Cancha de voleibol'], claves: ['voleibol', 'vóley'] },
    { id: 'sintetica', nombre: 'Cancha sintética', x: 4, z: -4, yaw: 0, lugares: ['Cancha sintética'], claves: ['cancha sintética', 'fútbol'] },
    { id: 'arte', nombre: 'Salón de Arte, Música y Cultura', x: -8.4, z: 7, yaw: IZQ,
      lugares: ['Salón de Arte, Música y Cultura'], claves: ['arte', 'música', 'cultura'] },
    { id: 'ecologico', nombre: 'Punto ecológico', x: -7.4, z: 12.6, yaw: IZQ },
  ],
  construir: azotea,
};

function azotea(k) {
  const W = A.W / 2, L = A.L / 2;
  k.limitar(-W - 0.5, -L - 0.5, W + 0.5, L + 0.5);
  // piso de baldosa rojiza y antepechos de ladrillo, sin techo
  k.rectsPiso.push({ x0: -W, z0: -L, x1: W, z1: L, tipo: 'rojizo', sinTecho: true });
  for (const [ax, az, bx, bz] of [[-W, -L, W, -L], [W, -L, W, L], [W, L, -W, L], [-W, L, -W, -L]])
    k.muro(ax, az, bx, bz, { mat: 'ladrillo', alto: 1.15 });
  // torre de escaleras (ladrillo y vidrio curvo) y salón de arte
  k.muro(-W, -4, -4, -4, { mat: 'ladrillo' });
  k.muro(-W, 4, -4, 4, { mat: 'ladrillo' });
  k.escalera(-8.6, -7.0, 3.4, -2.0, 'baja', { barandas: [true, true] });
  k.portal(-8.6, -1.8, -7.0, -0.4, 5, 'esc0');
  k.caja(W - 4, 0.2, 8, 'concreto', -(W + 4) / 2, ALTO + 0.1, 0);
  k.muro(-W, 4, -W, 11);
  k.muro(-W, 11, -6, 11, { mat: 'ladrillo' });
  k.muro(-6, 4, -6, 11, { mat: 'ladrillo', huecos: [[2.4, 3.5]] });
  k.puerta(-6, 7, PI, { color: 'puertaNaranja', abierta: false });
  k.letrero(['Salón de Arte,', 'Música y Cultura'], -5.9, 1.9, 7.9, IZQ, 'piso');
  k.caja(W - 6, 0.2, 7, 'concreto', -(W + 6) / 2, ALTO + 0.1, 7.5);
  k.colocar(canecas(['#2e7d32', '#9e9e9e', '#1565c0', '#f9a825']), -9.5, 12.6, IZQ);
  k.etiqueta('Punto ecológico', -9.5, 1.6, 12.6);
  k.etiqueta('Cuarto técnico', -9.5, 2.2, 16.5);
  k.caja(4, 2.6, 3, 'concreto', -9.5, 1.3, 17.5);
  k.obstaculo(-11.5, 16, -7.5, 19);
  // canchas con malla
  cancha(k, 4, 10, 12, 8, '#c96f43', 'voleibol');
  cancha(k, 4, -11.5, 14, 19, '#3e9b4f', 'sintetica');
  k.etiqueta('Cancha de voleibol', 4, 3.2, 10);
  k.etiqueta('Cancha sintética', 4, 3.6, -11.5);
}

function cancha(k, x, z, w, d, color, tipo) {
  const piso = new THREE.Mesh(new THREE.BoxGeometry(w, 0.03, d), mat(color));
  piso.position.set(x, 0.015, z);
  k.add(piso);
  const linea = (lw, ld, lx, lz) => { const l = new THREE.Mesh(new THREE.BoxGeometry(lw, 0.035, ld), mat('#f5f5f5')); l.position.set(x + lx, 0.02, z + lz); k.add(l); };
  linea(w - 1, 0.08, 0, -d / 2 + 0.5); linea(w - 1, 0.08, 0, d / 2 - 0.5);
  linea(0.08, d - 1, -w / 2 + 0.5, 0); linea(0.08, d - 1, w / 2 - 0.5, 0);
  linea(w - 1, 0.08, 0, 0);
  if (tipo === 'voleibol') {
    for (const sx of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.5, 8), mat('acero')); p.position.set(x + sx * (w / 2 - 0.3), 1.25, z); k.add(p); }
    const red = new THREE.Mesh(new THREE.BoxGeometry(w - 0.6, 0.9, 0.02), mat('#202326')); red.material = new THREE.MeshStandardMaterial({ color: '#202326', transparent: true, opacity: 0.5 });
    red.position.set(x, 2.0, z); k.add(red);
  } else {
    for (const sz of [-1, 1]) {           // arcos
      const arco = new THREE.Group();
      for (const sx of [-1.5, 1.5]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2, 0.08), mat('#f5f5f5')); p.position.set(sx, 1, 0); arco.add(p); }
      const t = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.08, 0.08), mat('#f5f5f5')); t.position.y = 2; arco.add(t);
      arco.position.set(x, 0, z + sz * (d / 2 - 0.4)); k.add(arco);
    }
  }
  // malla perimetral (se ve a través)
  const malla = new THREE.MeshStandardMaterial({ color: '#4a4f54', transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false });
  const alto = tipo === 'voleibol' ? 3.5 : 5;
  for (const [mx, mz, mw, md] of [[0, -d / 2, w, 0.02], [0, d / 2, w, 0.02], [-w / 2, 0, 0.02, d], [w / 2, 0, 0.02, d]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(mw, alto, md), malla); m.position.set(x + mx, alto / 2, z + mz); k.add(m);
  }
  for (let px = -w / 2; px <= w / 2 + 0.01; px += w / 4)
    for (const pz of [-d / 2, d / 2]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, alto, 6), mat('#4a4f54')); p.position.set(x + px, alto / 2, z + pz); k.add(p); }
  // La cancha es transitable por dentro; la malla tiene una puerta frente al corredor
  k.muros.push({ ax: x - w / 2, az: z - d / 2, bx: x - w / 2, bz: z + d / 2 });
  k.muros.push({ ax: x + w / 2, az: z - d / 2, bx: x + w / 2, bz: z + d / 2 });
  const lejos = z > 0 ? z + d / 2 : z - d / 2;
  k.muros.push({ ax: x - w / 2, az: lejos, bx: x + w / 2, bz: lejos });
}

/* ======================================================================== Muebles propios de A */
function cafeteria(k, g, s) {
  // Barra de comidas contra el muro exterior, con locales (como en el video) y mesas en el resto
  k.colocar(barraCafeteria(Math.min(10, g.largo - 3)), g.xe - g.sg * 0.8, g.cz, g.sg > 0 ? DER : IZQ);
  k.imagen(texturaMenu(), 4.2, 1.6, g.xe - g.sg * 0.1, 2.15, g.cz, g.sg > 0 ? DER : IZQ);
  k.colocar(nevera('#c62828'), g.xe - g.sg * 0.5, s.z1 - 1.0, g.sg > 0 ? DER : IZQ);
  k.colocar(nevera('#1565c0'), g.xe - g.sg * 0.5, s.z1 - 2.1, g.sg > 0 ? DER : IZQ);
  k.colocar(caja1(), g.xe - g.sg * 2.2, s.z0 + 1.4, g.sg > 0 ? DER : IZQ);
  for (const x of [s.z0 + 0.8]) k.colocar(microondas(), g.xe - g.sg * 0.4, x, 0, false, 0.78);
  for (let z = s.z0 + 1.6; z < s.z1 - 1.2; z += 2.1)
    for (let x = Math.min(g.xi, g.xe) + 1.2; x < Math.max(g.xi, g.xe) - 3.2; x += 2.1) {
      k.colocar(mesaMadera(1.1, 0.75, '#d0b48a'), x, z, 0);
      for (const [dx, dz, r] of [[-0.3, 0.6, PI], [0.3, 0.6, PI], [-0.3, -0.6, 0], [0.3, -0.6, 0]])
        k.colocar(silla('#f2f2f2', 'plastica'), x + dx, z + dz, r, false);
    }
  // paneles de colores colgados del techo
  const colores = ['#f9c74f', '#2a9fd6', '#8ac926', '#ef476f'];
  for (let i = 0, z = s.z0 + 1.5; z < s.z1 - 1; z += 2.6, i++) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.04, 0.9), mat(colores[i % 4]));
    p.position.set(g.cx, ALTO - 0.35, z); p.rotation.y = 0.3 * (i % 2 ? 1 : -1);
    k.add(p);
  }
  k.letrero(['CAFETERÍA'], g.cx, 2.6, s.z0 + 0.1, 0, 'aviso-oscuro');
}

function papeleria(k, g, s) {
  k.colocar(mostradorVidrio(g.largo - 1.2), g.cx, g.cz, g.sg > 0 ? DER : IZQ);
  k.colocar(estanteria(g.largo - 1, 2.0, 'insumos'), g.xe - g.sg * 0.3, g.cz, g.sg > 0 ? DER : IZQ);
}

function cajero(k, g, s) {
  const c = new THREE.Group();
  caja(c, 0.8, 1.7, 0.7, '#1f3c88', 0, 0.85, 0);
  caja(c, 0.5, 0.35, 0.02, '#0b1220', 0, 1.3, 0.36);
  caja(c, 0.8, 0.25, 0.72, '#0f2a66', 0, 1.82, 0);
  k.colocar(c, g.xe - g.sg * 0.6, g.cz, g.sg > 0 ? DER : IZQ);
  k.letrero(['BBVA'], g.xe - g.sg * 0.1, 2.4, g.cz, g.sg > 0 ? DER : IZQ, 'aviso-azul');
}

function biblioteca(k, g, s) {
  // Fachada de vidrio con el letrero "Bibliotecas Activas" y doble altura con escalera turquesa
  k.vidriera(g.xi, s.z0, g.xi, s.z1, { huecos: [[s.z1 - s.z0 - 6, s.z1 - s.z0 - 4]] });
  k.letrero(['Bibliotecas Activas', 'conoce, aprende y disfruta'], g.xi - g.sg * 0.1, 2.6, s.z1 - 5, g.sg > 0 ? DER : IZQ, 'aviso');
  k.colocar(mostradorBiblioteca(), g.xi + g.sg * 2.2, s.z1 - 3.5, g.sg > 0 ? IZQ : DER);
  for (let z = s.z0 + 1.2; z < s.z1 - 6; z += 1.6)
    k.colocar(estanteria(4.2, 2.1, 'libros'), g.xe - g.sg * 2.6, z, 0);
  for (let z = s.z0 + 2; z < s.z1 - 7; z += 2.8)
    for (const dx of [2.2, 4.6]) {
      k.colocar(mesaMadera(1.6, 0.9, '#c9a571'), g.xi + g.sg * dx, z, 0);
      for (const [ex, ez, r] of [[-0.4, 0.7, PI], [0.4, 0.7, PI], [-0.4, -0.7, 0], [0.4, -0.7, 0]])
        k.colocar(silla('#3d5a99'), g.xi + g.sg * dx + ex, z + ez, r, false);
    }
  for (const z of [s.z1 - 1.2, s.z1 - 2.2]) k.colocar(sofa('#159a9c'), g.xe - g.sg * 1.2, z, g.sg > 0 ? DER : IZQ);
  k.colocar(escaleraTurquesa(), g.xe - g.sg * 0.9, s.z0 + 4, 0, true);
  k.colocar(lockers({ cols: 6, filas: 5, tipo: 'vidrio' }), g.xi + g.sg * 0.5, s.z1 - 1.2, g.sg > 0 ? DER : IZQ);
}

function bibliotecaAlta(k, g, s) {
  k.vidriera(g.xi, s.z0, g.xi, s.z1, { huecos: [[s.z1 - s.z0 - 3, s.z1 - s.z0 - 1]] });
  k.letrero(['Biblioteca', 'segundo nivel'], g.xi - g.sg * 0.1, 2.6, s.z1 - 2, g.sg > 0 ? DER : IZQ, 'aviso');
  for (let z = s.z0 + 1.2; z < s.z1 - 4; z += 2.4) {
    k.colocar(mesaMadera(2.4, 1.0, '#c9a571'), g.cx, z, 0);
    for (const dx of [-0.8, 0, 0.8]) for (const [dz, r] of [[0.75, PI], [-0.75, 0]]) k.colocar(silla('#7a8794'), g.cx + dx, z + dz, r, false);
  }
  k.colocar(baranda(g.largo - 2), g.xe - g.sg * 2.5, g.cz, IZQ, true);
}

function mostradorVidrio(w) {
  const g = new THREE.Group();
  caja(g, w, 0.9, 0.55, '#d8d2c8', 0, 0.45, 0);
  caja(g, w, 0.35, 0.55, 'vidrio', 0, 1.08, 0);
  return g;
}
function mostradorBiblioteca() {
  const g = new THREE.Group();
  caja(g, 3.2, 1.05, 0.8, '#b6d68a', 0, 0.52, 0);
  caja(g, 3.3, 0.05, 0.9, '#8d6e4f', 0, 1.07, 0);
  caja(g, 0.5, 0.32, 0.03, 'negro', -0.6, 1.3, 0.1);
  return g;
}
function sofa(color) {
  const g = new THREE.Group();
  caja(g, 1.6, 0.45, 0.8, color, 0, 0.23, 0);
  caja(g, 1.6, 0.5, 0.18, color, 0, 0.6, -0.31);
  return g;
}
function escaleraTurquesa() {
  const g = new THREE.Group();
  for (let i = 0; i < 12; i++) caja(g, 1.1, 0.06, 0.32, '#8b5a33', 0, 0.25 + i * 0.25, -i * 0.28);
  for (const x of [-0.6, 0.6]) {
    const r = caja(g, 0.05, 0.05, 4.3, '#1d8f9a', x, 2.3, -1.55);
    r.rotation.x = Math.atan2(3, 3.3);
  }
  caja(g, 0.12, 3.0, 0.12, '#1d8f9a', 0, 1.5, -3.1);
  return g;
}
function baranda(L) {
  const g = new THREE.Group();
  caja(g, L, 0.05, 0.05, 'marco', 0, 1.05, 0);
  for (let x = -L / 2; x <= L / 2; x += 1.2) caja(g, 0.04, 1.05, 0.04, 'marco', x, 0.52, 0);
  caja(g, L, 1.0, 0.02, 'vidrio', 0, 0.55, 0);
  return g;
}

/* ======================================================================== Exportación */
export function nivelesB(base) {
  const [n1, n0, s2] = base;
  n1.construir = piso1Completo;
  n1.destinos = [...n1.destinos.filter(d => d.id !== 'escaleras'),
    { id: 'escaleras', nombre: 'Escaleras (sube y baja)', x: 0.75, z: -2.6, yaw: 0 },
    { id: 'esc0', nombre: 'Llegada desde el Piso 2', x: 0.75, z: -2.8, yaw: PI, oculto: true },
    { id: 'desdeA', nombre: 'Paso al Bloque A', x: 2.5, z: -10.4, yaw: PI, oculto: true }];
  s2.construir = sotano2Completo;
  s2.destinos = [...s2.destinos, { id: 'paraA', nombre: 'Paso al Bloque A (sótano)', x: 7.5, z: 14.2, yaw: 0, oculto: true }];
  return [B7, B6, B5, B4, B3, B2, n1, n0, s2];
}

export const nivelesA = [A6, A5, A4, A3, A2, A1, A0];
export { nombreNivel };
