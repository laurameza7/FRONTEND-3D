import * as THREE from 'three';
import { ALTO, mat, lienzo, textura } from './recorrido.js';

/*
 * Planos amoblados del interior de los bloques, hechos a partir de las fotos del campus.
 * Coordenadas en metros dentro del bloque: x de izquierda a derecha y z de atrás (-) hacia la
 * entrada (+). La distribución exacta de muros es aproximada; los muebles, letreros y
 * materiales siguen lo que se ve en las fotos. Los espacios sin fotos se marcan "aproximado".
 */

const PI = Math.PI, DER = -PI / 2, IZQ = PI / 2;   // rotaciones: mira a +x (DER) / -x (IZQ)

/* ======================================================================== Bloque B · Piso 1 */
function piso1(k) {
  k.limitar(-11, -15, 11, 15);
  k.piso(-11, -15, 11, 15);

  // Fachada de vidrio hacia el sendero (entrada con puertas de vidrio)
  k.vidriera(-11, 15, 11, 15, { huecos: [[9.6, 12.4]] });
  k.puerta(-1.4, 15, 0, { vidrio: true, ancho: 1.3 });
  k.puerta(1.4, 15, PI, { vidrio: true, ancho: 1.3 });
  k.letrero('SALIDA', 0, 2.7, 14.85, PI, 'salida');
  k.muro(-11, 15, -11, -15, { mat: 'ladrillo' });
  k.muro(11, 15, 11, -15, { mat: 'ladrillo' });
  k.muro(-11, -15, 11, -15, { mat: 'ladrillo' });

  // Vestíbulo: pared blanca a la izquierda (AMI) y de ladrillo a la derecha (Admisiones)
  k.muro(-3, 15, -3, 3, { huecos: [[8.6, 10]] });
  k.muro(-11, 3, -3, 3, { mat: 'ladrillo' });
  k.muro(3, 15, 3, 3, { mat: 'ladrillo', huecos: [[2.6, 4.0]], ventanas: [[5.6, 8.8]] });
  k.muro(3, 3, 11, 3, { mat: 'ladrillo' });
  k.puerta(3, 11.7, IZQ, { color: 'puertaRoja', ancho: 1.3 });
  k.letrero(['ADMISIONES, REGISTRO Y', 'CONTROL ACADÉMICO', 'admissions and records'], 2.9, 2.5, 11.7, DER, 'ucc');
  k.letrero(['AMI', 'ICETEX', 'DARC', 'TESORERÍA', 'CONTABILIDAD'], -2.9, 1.65, 13.4, IZQ, 'ami');
  k.letrero(['AMI · ICETEX', 'TESORERÍA · CONTABILIDAD'], -2.9, 2.55, 5.7, IZQ, 'ucc');
  k.colocar(maquinaNovaventa(), -2.45, 11.2, IZQ);
  k.colocar(figuraRecortada(), -2.55, 12.45, IZQ + 0.3);
  k.colocar(canecas(['#2e7d32', '#212121', '#e8e8e8']), 2.55, 5.0, DER);
  k.imagen(texturaCirculoOptico(), 2.3, 2.3, 0, 0.012, 12.6, 0, true);
  k.lamparas(0, 4.5, 0, 14, { eje: 'z', paso: 3 });
  k.tuberias(-1.6, 15, -1.6, -12, ALTO - 0.1, 2);

  // Hall: bancas azules, carteleras, escalera al Piso 2 y bajada al Piso 0
  k.muro(-3, 3, -3, -12, { mat: 'ladrillo' });
  k.muro(3, 3, 3, -12, { mat: 'ladrillo', huecos: [[1.4, 2.6]] });
  k.muro(-3, -12, 3, -12, { mat: 'ladrillo' });
  k.puerta(3, 1.0, IZQ, { color: '#3a3d40', ancho: 1.2, vidrio: true });
  k.colocar(banca(5, '#2c3e9e'), -2.6, -0.6, IZQ);
  k.colocar(cartelera(1.6, 1.1, '#244a39'), -2.9, -0.4, IZQ, false, 1.55);
  k.colocar(cartelera(0.9, 1.4, '#f4f4f4'), -2.9, 1.6, IZQ, false, 1.4);
  k.escalera(-2.9, -0.8, -4, -10, 'baja', { barandas: [false, true] });
  k.escalera(-0.5, 2.0, -4, -11.5, 'sube');
  k.obstaculo(-0.5, -11.5, 2.0, -4);          // los pisos 2 a 7 aún no están en el recorrido
  k.letrero(['Piso 0 · Lockers', 'Clínica Odontológica'], -1.85, 2.55, -3.95, 0, 'colgate', 'escalera');
  k.letrero(['PISO 1 - Bloque B', 'first floor block b'], -2.9, 1.9, -3.1, IZQ, 'piso');
  k.letrero(['Pisos 2 a 7', 'próximamente en el recorrido'], 0.75, 2.6, -3.95, 0, 'aviso-oscuro');
  k.portal(-2.9, -9, -0.8, -7.2, -1, 'llegada');
  k.lamparas(0, -2, 0, 2, { eje: 'z', paso: 3 });

  // Oficinas de atención (izquierda, sin fotos del interior)
  for (const [z, nombre] of [[5, 'AMI'], [7.5, 'ICETEX'], [10, 'TESORERÍA'], [12.5, 'CONTABILIDAD']]) {
    k.colocar(escritorio(), -9, z, IZQ);
    k.colocar(silla('#2c3e9e'), -7.2, z, DER);
    k.letrero(nombre, -8.4, 2.45, z, IZQ, 'aviso-azul');
  }
  k.colocar(archivador(), -10.6, 9, IZQ);
  k.colocar(planta(), -3.6, 3.6, 0);
  k.lamparas(-7, 5, -7, 13, { eje: 'z', paso: 4 });

  // Admisiones, Registro y Control Académico (derecha, sin fotos del interior)
  for (const z of [5.5, 8.5, 11.5]) {
    k.colocar(escritorio(), 8.6, z, DER);
    k.colocar(silla('#2c3e9e'), 6.8, z, IZQ);
  }
  k.colocar(archivador(), 10.6, 13.6, DER);
  k.colocar(archivador(), 10.6, 4.2, DER);
  k.colocar(planta(), 4.0, 14.3, 0);
  k.lamparas(7, 5, 7, 13, { eje: 'z', paso: 4 });

  // Oficina junto a la escalera (sin registrar)
  k.colocar(escritorio(), 8.5, -2, DER);
  k.colocar(escritorio(), 8.5, -6, DER);
  k.colocar(estanteria(2.4, 2.1, 'carpetas'), 7, -11.6, 0);
  k.lamparas(7, -9, 7, 0, { eje: 'z', paso: 4 });

  k.zona('entrada', -3, 3, 3, 15);
  k.zona('sala', -3, -12, 3, 3);
  k.zona('tesoreria', -11, 3, -3, 15);
  k.zona('admisiones', 3, 3, 11, 15);
  k.zona('oficina', 3, -12, 11, 3);
}

/* ======================================================================== Bloque B · Piso 0 (sótano 1) */
function piso0(k) {
  k.limitar(-11, -15, 11, 15);
  k.piso(-11, -15, 11, 15);
  k.caja(8, 0.012, 12, mat('#d9c8a4'), -7, 0.006, -5);        // piso beige de la zona de casilleros
  k.muro(-11, 15, -11, -15, { mat: 'ladrillo' });
  k.muro(11, 15, 11, -15);
  k.muro(-11, -15, 11, -15, { mat: 'ladrillo' });
  k.muro(-11, 15, 11, 15);

  // Escalera que sube al Piso 1 (llegada)
  k.escalera(-2.9, -0.8, 6, 12, 'sube', { barandas: [false, true] });
  k.portal(-2.9, 8.6, -0.8, 10, 1, 'desdePiso0');
  k.muro(-3, 15, -3, 4.5, { mat: 'ladrillo' });
  k.muro(-0.8, 12, 3.4, 12);
  k.letrero(['PISO 0 - Bloque B', 'floor zero block b'], -2.9, 1.9, 5.2, IZQ, 'piso');

  // Corredor de lockers
  k.colocar(lockers({ cols: 3, filas: 4, tipo: 'vidrio' }), -2.7, 0, IZQ);
  k.colocar(lockers({ cols: 4, filas: 3, tipo: 'colores' }), 1.15, -1.2, DER);
  k.colocar(lockers({ cols: 4, filas: 4, tipo: 'vidrio' }), 1.15, -4.2, DER);
  k.colocar(lockers({ cols: 4, filas: 3, tipo: 'colores' }), 3.05, -6.6, DER);
  k.colocar(lockers({ cols: 3, filas: 3, tipo: 'colores' }), 3.05, 3.4, DER);
  k.colocar(canecas(['#1565c0', '#2e7d32', '#9e9e9e']), -2.55, -9.8, IZQ);
  k.colocar(planta(), 2.4, -14.3, 0);
  k.puerta(0.4, -14.95, 0, { color: 'puertaBlanca', abierta: false, ancho: 1.1 });
  k.muro(-3, -11, -3, -15, { mat: 'ladrillo' });
  k.colocar(extintor(), -2.85, -13, IZQ, false, 1.0);
  k.lamparas(0.2, -14, 0.2, 4, { eje: 'z', paso: 3 });
  k.tuberias(-1.2, 12, -1.2, -15, ALTO - 0.1, 3);

  // Laboratorio de Morfología y ambiente de práctica (oficinas de vidrio a la derecha)
  k.vidriera(3.4, 5, 3.4, -12, { banda: true, huecos: [[2.5, 3.5], [6.8, 8.0]] });
  k.muro(3.4, -0.4, 11, -0.4);
  k.muro(3.4, 5, 11, 5);
  k.muro(3.4, -12, 11, -12);
  k.letrero(['LABORATORIO DE', 'MORFOLOGÍA', 'morphology lab'], 3.3, 2.0, -1.2, DER, 'ucc');
  k.imagen(texturaLogoUcc(), 0.9, 0.9, 3.33, 1.45, -2.4, DER);
  k.colocar(afiche('codigo'), 3.32, -4.4, DER, false, 1.0);
  for (const z of [-3.4, -6.5, -9.6]) {
    k.colocar(mesaAcero(), 7.2, z, 0);
    for (const [dx, dz] of [[-0.75, 0.75], [0.75, 0.75], [-0.75, -0.75], [0.75, -0.75]]) k.colocar(taburete(), 7.2 + dx * 1.3, z + dz, 0, false);
  }
  k.colocar(estanteria(3, 2, 'modelos'), 10.7, -6, DER);
  k.colocar(lavamanos(), 7.2, -11.55, 0);
  k.imagen(texturaTablero(), 2.4, 1.2, 7.2, 1.6, -0.5, PI);
  k.lamparas(7.2, -11, 7.2, -1.5, { eje: 'z', paso: 3 });
  k.colocar(mesaMadera(2, 1), 7.2, 2.4, 0);
  k.colocar(estanteria(2.2, 2, 'carpetas'), 10.7, 2.4, DER);
  k.lamparas(7.2, 1, 7.2, 4, { eje: 'z', paso: 3 });

  // Zona de casilleros de Morfología (izquierda, abierta con columnas)
  k.muro(-11, -11, -3, -11, { mat: 'ladrillo' });
  k.muro(-11, 1, -3, 1, { mat: 'ladrillo' });
  for (const z of [-2.5, -7.5]) k.colocar(columna(), -3, z, 0);
  k.colocar(lockers({ cols: 6, filas: 5, tipo: 'metal' }), -6.8, -10.6, 0);
  k.colocar(lockers({ cols: 6, filas: 5, tipo: 'metal' }), -10.6, -5.2, DER);
  const bancoCascos = lockers({ cols: 5, filas: 5, tipo: 'metal' });
  for (const x of [-0.4, 0.3]) {
    const casco = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), mat('negro'));
    casco.position.set(x, 2.58, 0);
    bancoCascos.add(casco);
  }
  k.colocar(bancoCascos, -6.5, -4.6, 0);
  k.colocar(mesaMadera(1.8, 0.9), -6.2, -1.6, 0);
  k.colocar(gabinete(), -9.6, 0.55, PI);
  k.colocar(canecas(['#e8e8e8', '#212121', '#2e7d32']), -3.6, -9.5, IZQ);
  k.lamparas(-7, -9, -7, 0, { eje: 'z', paso: 3 });

  // Bajada a la Clínica Odontológica (escalera en caja de vidrio)
  k.escalera(-8.6, -5.4, 5, 11, 'baja');
  k.vidriera(-9, 4.6, -9, 12);
  k.vidriera(-5, 4.6, -5, 12);
  k.muro(-9, 12, -5, 12);
  k.letrero(['Clínica', 'Odontológica'], -7, 2.6, 4.55, PI, 'colgate', 'sillon');
  k.letrero(['CLÍNICA ODONTOLÓGICA', '9901  ›'], -10.9, 1.7, 3.2, DER, 'ucc');
  k.letrero('SALIDA', -7, 2.82, 4.6, PI, 'salida');
  k.portal(-8.6, 7.4, -5.4, 9.2, -2, 'llegada');
  k.lamparas(-7, 2.5, -7, 2.5, { eje: 'x' });

  k.zona('lockers', -3, -15, 3.4, 4.5);
  k.zona('llegada', -3, 4.5, 3.4, 15);
  k.zona('morfologia', 3.4, -12, 11, -0.4);
  k.zona('ambiente', 3.4, -0.4, 11, 5);
  k.zona('casilleros', -11, -11, -3, 1);
  k.zona('bajadaClinica', -11, 1, -3, 15);
}

/* ======================================================================== Bloque B · Sótano 2 (Clínica Odontológica) */
function sotano2(k) {
  k.limitar(-12, -16, 12, 16);
  k.piso(-12, -16, 12, 16, 'baldosa');
  k.muro(-12, 16, -12, -16);
  k.muro(12, 16, 12, -16, { ventanas: [[1, 2.8], [3.2, 5], [5.4, 7.2]] });
  k.muro(-12, -16, 12, -16);
  k.muro(-12, 16, -1, 16);
  k.muro(-1, 16, 2, 16, { mat: 'ladrillo' });
  k.muro(2, 16, 12, 16);

  // Llegada por la escalera desde el Piso 0
  k.escalera(-11.6, -8.6, 10, 15.6, 'sube', { barandas: [false, true] });
  k.portal(-11.6, 12.4, -8.6, 13.6, -1, 'desdeClinica');
  k.letrero(['CLÍNICA ODONTOLÓGICA', 'dental clinic'], -10.1, 2.65, 9.7, 0, 'ucc');

  // Sala de espera (vidrio con marcos negros)
  k.vidriera(-6, 16, -6, 8);
  k.vidriera(-6, 8, 12, 8, { huecos: [[5, 7.4]] });
  k.letrero(['SALA DE ESPERA', 'waiting room'], -2.6, 1.85, 7.97, PI, 'ucc');
  k.letrero('SALIDA', 3.3, 2.4, 7.97, PI, 'salida');
  for (const z of [10.2, 11.5, 12.8, 14.1]) {
    k.colocar(banca(4, '#245f5b'), 0.6, z, PI);
    k.colocar(banca(4, '#245f5b'), 5.2, z, PI);
    k.colocar(banca(4, '#245f5b'), 9.6, z, PI);
  }
  k.imagen(texturaMuralInfantil(), 3.6, 2.3, -3.7, 1.45, 15.9, PI);
  k.colocar(repisaJuguetes(), -5.3, 14.2, IZQ);
  k.colocar(abaco(), -4.6, 12.6, PI);
  k.colocar(cadena(), -2.0, 12.6, 0, false);
  k.colocar(cartelera(1.5, 1.2, '#2b3f8c', 'endodoncia'), 11.85, 11.2, DER, false, 1.5);
  k.lamparas(-3, 9.5, 11, 15, { tipo: 'panel', paso: 2.2 });

  // Corredor y fila de servicios
  k.lamparas(-10, 6, 10, 6, { eje: 'x', paso: 4 });
  // Atención al Usuario · Dental Deals · almacenamiento de insumos
  k.muro(-12, 4, -6, 4, { mostrador: [[0.6, 4.4]], huecos: [[4.8, 5.8]] });
  k.letrero('Dental Deals', -10.9, 2.2, 4.1, 0, 'aviso-azul');
  k.letrero('ATENCIÓN AL USUARIO', -9.3, 2.2, 4.1, 0, 'aviso-oscuro');
  k.letrero(['ÁREA DE ALMACENAMIENTO', 'INSUMOS ESTUDIANTES'], -8.1, 2.65, 4.1, 0, 'aviso-azul');
  k.colocar(estanteria(4.8, 2.2, 'productos'), -9.2, -2.7, 0);
  k.colocar(estanteria(2.6, 2.2, 'insumos'), -11.7, 0.6, DER);
  k.colocar(escritorio(), -9.6, 2.5, PI);
  k.colocar(escritorio(), -7.8, 2.5, PI);
  k.lamparas(-9, -1.5, -9, 2.5, { eje: 'x', paso: 3 });
  // Baños
  k.muro(-6, 4, -2, 4);
  k.puerta(-5.0, 4.06, 0, { color: 'puertaBlanca', abierta: false });
  k.puerta(-3.0, 4.06, 0, { color: 'puertaBlanca', abierta: false });
  k.letrero('BAÑOS', -5.0, 2.45, 4.1, 0, 'banos');
  k.letrero('BAÑOS', -3.0, 2.45, 4.1, 0, 'banos');
  k.colocar(extintor(), -1.85, 4.3, 0, false, 1.0);
  // Paso a la clínica de pregrado
  k.letrero(['Clínica', 'Odontológica'], 0, 2.65, 4.05, 0, 'colgate', 'sillon');
  // Archivo de Historias Clínicas
  k.muro(2, 4, 5.5, 4, { huecos: [[0.4, 1.4]], ventanas: [[1.8, 3.3]] });
  k.letrero(['Archivo de', 'Historias Clínicas'], 2.9, 2.65, 4.1, 0, 'colgate', 'archivo');
  k.colocar(mesaMadera(1.6, 0.9, '#7bc043'), 3.8, 0.6, 0);
  k.colocar(silla('#f2f2f2', 'plastica'), 3.2, 1.4, PI);
  k.colocar(silla('#f2f2f2', 'plastica'), 4.4, 1.4, PI);
  k.colocar(silla('#202326'), 3.8, -0.3, 0);
  k.colocar(estanteria(3.2, 2.2, 'historias'), 3.75, -2.7, 0);
  k.lamparas(3.75, -1, 3.75, 2, { eje: 'x', paso: 3 });
  // Clínica Odontológica de Posgrado
  k.vidriera(5.5, 4, 12, 4, { banda: true, huecos: [[1.6, 4.0]] });
  k.letrero(['Clínica Odontológica', 'Postgrado'], 8.3, 2.65, 4.1, 0, 'colgate', 'sillon');
  for (const x of [6.8, 9.0, 11.2]) k.colocar(unidadDental(), x, -1.3, 0);
  for (const x of [7.9, 10.1]) k.mampara(x, -3, x, 0.6);
  k.colocar(escritorio(), 11.3, 2.6, DER);
  k.lamparas(9, -1.5, 9, 2.5, { eje: 'x', paso: 3 });
  // muros laterales de la fila
  for (const x of [-6, -2, 2, 5.5]) k.muro(x, 4, x, -3);
  k.muro(-12, -3, -2, -3);
  k.muro(2, -3, 12, -3);

  // Clínica Odontológica de pregrado: pasillo central, columnas y cubículos con mamparas
  k.letrero(['CLÍNICA ODONTOLÓGICA', 'dental clinic'], 0, 2.65, -2.95, 0, 'ucc');
  for (const z of [-5.6, -9.4, -13.2]) { k.colocar(columna(), -2.1, z, 0); k.colocar(columna(), 2.1, z, 0); }
  for (const z of [-5.2, -8.9, -12.6]) {
    for (const x of [-4.6, -9.0]) k.colocar(unidadDental(), x, z, IZQ);
    for (const x of [4.6, 9.0]) k.colocar(unidadDental(), x, z, DER);
  }
  for (const z of [-7.05, -10.75, -14.4]) {
    k.mampara(-2.6, z, -11.8, z);
    k.mampara(2.6, z, 11.8, z);
  }
  k.colocar(mesaMadera(1.6, 0.8, '#dcdcdc'), 0, -14.6, 0);
  for (const x of [-0.5, 0.5]) k.colocar(silla('#202326'), x, -13.8, PI);
  k.puerta(0, -15.95, 0, { color: 'puertaBlanca', abierta: false, ancho: 1.1 });
  k.letrero('☢ RADIOLOGÍA', 1.4, 2.0, -15.9, 0, 'aviso');
  k.etiqueta('Zona de radiología (sin registrar)', 0, 2.6, -15.6);
  k.lamparas(-9, -15, 9, -4, { eje: 'x', paso: 3.6 });

  k.zona('llegada', -12, 8, -6, 16);
  k.zona('sala', -6, 8, 12, 16);
  k.zona('atencion', -12, -3, -6, 4);
  k.zona('archivo', 2, -3, 5.5, 4);
  k.zona('posgrado', 5.5, -3, 12, 4);
  k.zona('pregrado', -12, -16, 12, -3);
}

/* ======================================================================== Catálogo de interiores */
export const INTERIORES = {
  B: {
    nombre: 'Bloque B',
    niveles: [
      {
        id: 1, nombre: 'Piso 1 · Entrada', corto: 'Piso 1', construir: piso1,
        destinos: [
          { id: 'entrada', nombre: 'Entrada del Bloque B', x: 0, z: 13.6, yaw: 0 },
          { id: 'admisiones', nombre: 'Admisiones, Registro y Control Académico', x: 4.4, z: 11.7, yaw: DER, aproximado: true,
            lugares: ['Admisiones, Registro y Control Académico (DARC)'], claves: ['Admisiones', 'Registro y Control'] },
          { id: 'tesoreria', nombre: 'AMI · ICETEX · Tesorería · Contabilidad', x: -4.3, z: 5.7, yaw: IZQ, aproximado: true,
            lugares: ['Tesorería', 'Contabilidad', 'ICETEX y crédito estudiantil', 'AMI (Atención Más Integral)'], claves: ['Tesorería', 'ICETEX'] },
          { id: 'sala', nombre: 'Sala de espera y escaleras', x: 0.4, z: -1.2, yaw: IZQ, lugares: ['Sala de espera del Piso 1'] },
          { id: 'escaleras', nombre: 'Bajada al Piso 0', x: -1.85, z: -2.4, yaw: 0 },
          { id: 'oficina', nombre: 'Oficina (sin registrar)', x: 4.4, z: 1.0, yaw: DER, aproximado: true },
          { id: 'desdePiso0', nombre: 'Llegada desde el Piso 0', x: -1.85, z: -2.6, yaw: PI, oculto: true },
        ],
      },
      {
        id: -1, nombre: 'Piso 0 (sótano 1)', corto: 'Piso 0', construir: piso0,
        destinos: [
          { id: 'llegada', nombre: 'Escaleras al Piso 1', x: -1.85, z: 5.1, yaw: 0 },
          { id: 'lockers', nombre: 'Lockers de estudiantes', x: -0.7, z: 1.5, yaw: 0, lugares: ['Lockers de estudiantes'], claves: ['lockers'] },
          { id: 'morfologia', nombre: 'Laboratorio de Morfología', x: 4.4, z: -2.4, yaw: DER, aproximado: true,
            nota: 'La entrada y el corredor son como en las fotos; el interior del laboratorio es aproximado.',
            lugares: ['Laboratorio de Morfología'], claves: ['Morfología'] },
          { id: 'casilleros', nombre: 'Casilleros de Morfología', x: -1.6, z: -4.6, yaw: IZQ },
          { id: 'ambiente', nombre: 'Ambiente de práctica (sin registrar)', x: 4.4, z: 2.0, yaw: DER, aproximado: true },
          { id: 'bajadaClinica', nombre: 'Bajada a la Clínica Odontológica', x: -7, z: 3.4, yaw: PI },
          { id: 'desdeClinica', nombre: 'Llegada desde la clínica', x: -7, z: 3.4, yaw: 0, oculto: true },
        ],
      },
      {
        id: -2, nombre: 'Sótano 2 · Clínica Odontológica', corto: 'Sótano 2', construir: sotano2, estilo: { piso: 'baldosa' },
        destinos: [
          { id: 'llegada', nombre: 'Escaleras al Piso 0', x: -10.1, z: 9.2, yaw: 0 },
          { id: 'sala', nombre: 'Sala de espera de la clínica', x: 0.2, z: 6.6, yaw: PI, lugares: ['Sala de espera de la Clínica Odontológica'] },
          { id: 'atencion', nombre: 'Atención al Usuario · Dental Deals', x: -6.7, z: 5.6, yaw: 0.35,
            lugares: ['Atención al Usuario de la clínica', 'Dental Deals'], claves: ['Atención al Usuario'] },
          { id: 'banos', nombre: 'Baños', x: -4, z: 5.6, yaw: 0, lugares: ['Baños de la clínica'] },
          { id: 'archivo', nombre: 'Archivo de Historias Clínicas', x: 3, z: 2.6, yaw: 0, lugares: ['Archivo de Historias Clínicas'] },
          { id: 'posgrado', nombre: 'Clínica Odontológica de Posgrado', x: 8.3, z: 2.8, yaw: 0, lugares: ['Clínica Odontológica de Posgrado'], claves: ['Posgrado'] },
          { id: 'pregrado', nombre: 'Clínica Odontológica (pregrado)', x: 0, z: -3.8, yaw: 0,
            lugares: ['Clínica Odontológica (pregrado)'], claves: ['Clínica Odontológica'] },
        ],
      },
    ],
  },
};

/* ======================================================================== Muebles */
function caja(g, w, h, d, m, x, y, z) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof m === 'string' ? mat(m) : m);
  b.position.set(x, y, z);
  g.add(b);
  return b;
}
function cilindro(g, r, h, m, x, y, z, seg = 12) {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), typeof m === 'string' ? mat(m) : m);
  c.position.set(x, y, z);
  g.add(c);
  return c;
}

/** Banco de lockers: 'colores' (azul/gris/verde/blanco), 'vidrio' (blancos con ventanilla) o 'metal' (grises con candado). */
function lockers({ cols = 4, filas = 4, tipo = 'colores' } = {}) {
  const g = new THREE.Group();
  const w = cols * 0.4, h = filas * 0.46, d = 0.48;
  caja(g, w, h, d, tipo === 'vidrio' ? '#ecebe7' : tipo === 'metal' ? '#8b9399' : '#9aa1a6', 0, 0.12 + h / 2, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) caja(g, 0.04, 0.12, 0.04, 'acero', sx * (w / 2 - 0.05), 0.06, sz * (d / 2 - 0.05));
  const colores = ['#2f8fd8', '#575f66', '#34383c', '#6cbf34', '#f1f2f2', '#2f8fd8', '#34383c', '#6cbf34', '#575f66'];
  for (let c = 0; c < cols; c++) for (let r = 0; r < filas; r++) {
    const x = -w / 2 + 0.2 + c * 0.4, y = 0.12 + 0.23 + r * 0.46, z = d / 2 + 0.012;
    const color = tipo === 'colores' ? colores[(c * 4 + r * 7 + cols) % colores.length] : tipo === 'vidrio' ? '#f6f5f2' : '#7f878d';
    caja(g, 0.37, 0.43, 0.02, color, x, y, z);
    if (tipo === 'vidrio') caja(g, 0.2, 0.3, 0.012, '#3b4850', x - 0.03, y + 0.02, z + 0.012);
    if (tipo === 'metal') caja(g, 0.05, 0.06, 0.03, '#c9a227', x + 0.12, y, z + 0.02);
    if (tipo === 'colores') for (let i = 0; i < 3; i++) caja(g, 0.015, 0.015, 0.005, '#222', x + 0.13, y + 0.12 - i * 0.03, z + 0.012);
    caja(g, 0.02, 0.09, 0.03, '#2a2a2a', x + (tipo === 'vidrio' ? 0.14 : 0.13), y - 0.05, z + 0.02);
  }
  return g;
}

function maquinaNovaventa() {
  const g = new THREE.Group();
  const frente = new THREE.MeshStandardMaterial({ map: texturaNovaventa(), roughness: 0.4 });
  const b = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.95, 0.85), [mat('#d7d9d8'), mat('#d7d9d8'), mat('#d7d9d8'), mat('#d7d9d8'), frente, mat('#d7d9d8')]);
  b.position.y = 0.975;
  g.add(b);
  return g;
}

function figuraRecortada() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 1.85), new THREE.MeshStandardMaterial({ map: texturaFigura(), transparent: true, side: THREE.DoubleSide, alphaTest: 0.1 }));
  m.position.y = 0.95;
  g.add(m);
  caja(g, 0.5, 0.03, 0.4, '#e9e9e9', 0, 0.015, 0.1);
  return g;
}

/** Banca de sillas unidas por una viga (azules en el Piso 1, verdes en la clínica). */
function banca(n, color) {
  const g = new THREE.Group();
  const ancho = n * 0.52;
  caja(g, ancho, 0.06, 0.06, 'negro', 0, 0.36, 0);
  for (const x of [-ancho / 2 + 0.2, ancho / 2 - 0.2]) {
    caja(g, 0.05, 0.36, 0.05, 'negro', x, 0.18, 0);
    caja(g, 0.06, 0.03, 0.55, 'negro', x, 0.015, 0);
  }
  const asiento = new THREE.MeshStandardMaterial({ color, roughness: 0.35 });
  for (let i = 0; i < n; i++) {
    const x = -ancho / 2 + 0.26 + i * 0.52;
    caja(g, 0.46, 0.07, 0.44, asiento, x, 0.44, 0.03);
    const respaldo = caja(g, 0.44, 0.42, 0.05, asiento, x, 0.72, -0.2);
    respaldo.rotation.x = -0.12;
  }
  return g;
}

function silla(color, tipo = 'oficina') {
  const g = new THREE.Group();
  if (tipo === 'plastica') {
    caja(g, 0.45, 0.05, 0.45, color, 0, 0.45, 0);
    caja(g, 0.45, 0.4, 0.04, color, 0, 0.68, -0.21);
    for (const [x, z] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) caja(g, 0.04, 0.45, 0.04, color, x, 0.22, z);
  } else {
    caja(g, 0.48, 0.08, 0.46, color, 0, 0.48, 0);
    caja(g, 0.44, 0.5, 0.06, color, 0, 0.82, -0.22);
    cilindro(g, 0.03, 0.4, 'acero', 0, 0.26, 0);
    for (let i = 0; i < 5; i++) {
      const pata = caja(g, 0.3, 0.03, 0.04, 'negro', 0, 0.05, 0);
      pata.rotation.y = (i / 5) * PI * 2;
      pata.translateX(0.14);
    }
  }
  return g;
}

function escritorio() {
  const g = new THREE.Group();
  caja(g, 1.4, 0.04, 0.7, '#e7e2d8', 0, 0.75, 0);
  caja(g, 0.04, 0.73, 0.66, 'marco', -0.66, 0.37, 0);
  caja(g, 0.04, 0.73, 0.66, 'marco', 0.66, 0.37, 0);
  caja(g, 0.4, 0.6, 0.6, '#cfcac0', 0.42, 0.37, 0);
  caja(g, 0.55, 0.34, 0.03, 'negro', 0, 1.0, -0.2);
  const pantalla = caja(g, 0.5, 0.29, 0.01, new THREE.MeshStandardMaterial({ color: '#3c6e9f', emissive: '#1b3550', emissiveIntensity: 0.6 }), 0, 1.0, -0.183);
  pantalla.rotation.y = 0;
  caja(g, 0.06, 0.15, 0.06, 'negro', 0, 0.82, -0.22);
  caja(g, 0.45, 0.02, 0.15, '#2b2b2b', 0, 0.78, 0.05);
  const s = silla('#202326');
  s.position.z = 0.6;
  s.rotation.y = PI;
  g.add(s);
  return g;
}

function archivador() {
  const g = new THREE.Group();
  caja(g, 0.5, 1.3, 0.6, '#9aa0a6', 0, 0.65, 0);
  for (let i = 0; i < 4; i++) caja(g, 0.18, 0.03, 0.02, 'acero', 0, 0.3 + i * 0.3, 0.31);
  return g;
}

function planta() {
  const g = new THREE.Group();
  const maceta = cilindro(g, 0.22, 0.45, '#b5582f', 0, 0.22, 0);
  maceta.geometry = new THREE.CylinderGeometry(0.24, 0.18, 0.45, 12);
  const hoja = new THREE.MeshStandardMaterial({ color: '#3f7f3a', side: THREE.DoubleSide });
  for (let i = 0; i < 9; i++) {
    const h = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.9, 4), hoja);
    h.position.set(0, 0.85, 0);
    h.rotation.set(0.5 + (i % 3) * 0.15, (i / 9) * PI * 2, 0, 'YXZ');
    h.translateY(0.2);
    g.add(h);
  }
  return g;
}

function canecas(colores) {
  const g = new THREE.Group();
  colores.forEach((c, i) => {
    caja(g, 0.38, 0.75, 0.4, c, -0.42 + i * 0.42, 0.38, 0);
    caja(g, 0.4, 0.06, 0.42, c, -0.42 + i * 0.42, 0.78, 0);
  });
  caja(g, 1.3, 0.04, 0.05, 'negro', 0, 0.02, 0.22);
  return g;
}

function cartelera(w, h, fondo, tipo) {
  const g = new THREE.Group();
  caja(g, w + 0.1, h + 0.1, 0.04, '#9a7650', 0, 0, 0);
  if (tipo === 'endodoncia') {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: texturaEndodoncia() }));
    m.position.z = 0.025; g.add(m);
  } else {
    caja(g, w, h, 0.05, fondo, 0, 0, 0);
    for (const [x, y, ww, hh] of [[-0.4, 0.2, 0.3, 0.4], [0, 0.25, 0.25, 0.32], [0.35, 0.1, 0.3, 0.45], [-0.1, -0.25, 0.3, 0.3]])
      if (Math.abs(x) < w / 2 - 0.1) caja(g, ww, hh, 0.01, '#fbfbf8', x * w / 1.6, y * h / 1.1, 0.03);
  }
  return g;
}

function afiche(tipo) {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1.0), new THREE.MeshStandardMaterial({ map: texturaCodigoConducta() }));
  g.add(m);
  return g;
}

function columna() {
  const g = new THREE.Group();
  caja(g, 0.5, ALTO, 0.5, 'blanco', 0, ALTO / 2, 0);
  return g;
}

function extintor() {
  const g = new THREE.Group();
  cilindro(g, 0.09, 0.5, '#c62828', 0, 0, 0.12);
  cilindro(g, 0.03, 0.08, 'negro', 0, 0.29, 0.12);
  caja(g, 0.3, 0.6, 0.03, '#d7d7d7', 0, 0, 0.0);
  return g;
}

function mesaAcero() {
  const g = new THREE.Group();
  caja(g, 2.2, 0.05, 1.0, 'acero', 0, 0.9, 0);
  for (const [x, z] of [[-1, -0.42], [1, -0.42], [-1, 0.42], [1, 0.42]]) caja(g, 0.05, 0.88, 0.05, 'acero', x, 0.44, z);
  caja(g, 2.1, 0.03, 0.9, 'acero', 0, 0.25, 0);
  return g;
}

function taburete() {
  const g = new THREE.Group();
  cilindro(g, 0.17, 0.06, 'negro', 0, 0.62, 0);
  cilindro(g, 0.025, 0.6, 'acero', 0, 0.3, 0);
  cilindro(g, 0.2, 0.02, 'acero', 0, 0.01, 0);
  return g;
}

function lavamanos() {
  const g = new THREE.Group();
  caja(g, 2.4, 0.9, 0.6, '#e9eaea', 0, 0.45, 0);
  caja(g, 0.6, 0.05, 0.4, 'acero', -0.6, 0.91, 0);
  caja(g, 0.6, 0.05, 0.4, 'acero', 0.6, 0.91, 0);
  for (const x of [-0.6, 0.6]) cilindro(g, 0.015, 0.3, 'acero', x, 1.05, -0.2);
  return g;
}

function mesaMadera(w, d, color = '#b88a5a') {
  const g = new THREE.Group();
  caja(g, w, 0.05, d, color, 0, 0.75, 0);
  for (const [x, z] of [[-w / 2 + 0.06, -d / 2 + 0.06], [w / 2 - 0.06, -d / 2 + 0.06], [-w / 2 + 0.06, d / 2 - 0.06], [w / 2 - 0.06, d / 2 - 0.06]])
    caja(g, 0.05, 0.73, 0.05, color === '#7bc043' ? '#c8c8c8' : '#7a5530', x, 0.37, z);
  return g;
}

function gabinete() {
  const g = new THREE.Group();
  caja(g, 1.0, 1.8, 0.5, '#f1f1ee', 0, 0.9, 0);
  caja(g, 0.01, 1.7, 0.02, '#cfcfcf', 0, 0.9, 0.26);
  return g;
}

/** Estantería con frente dibujado: 'carpetas', 'historias' (carpetas verdes), 'productos', 'insumos', 'modelos'. */
function estanteria(w, h, tipo) {
  const g = new THREE.Group();
  const frente = new THREE.MeshStandardMaterial({ map: texturaEstante(tipo, w, h) });
  const lado = mat(tipo === 'insumos' ? '#d8d2c8' : '#44484c');
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.45), [lado, lado, lado, lado, frente, lado]);
  b.position.y = h / 2;
  g.add(b);
  if (tipo === 'modelos') {   // modelos anatómicos sobre la repisa
    for (let i = 0; i < 4; i++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), mat('#e8dcc8'));
      c.position.set(-w / 2 + 0.4 + i * (w - 0.8) / 3, h + 0.11, 0);
      g.add(c);
    }
  }
  return g;
}

/** Unidad odontológica: sillón azul, lámpara, módulo con escupidera, taburete y caneca roja. */
function unidadDental() {
  const g = new THREE.Group();
  const azul = new THREE.MeshStandardMaterial({ color: '#2a5d8f', roughness: 0.35 });
  caja(g, 0.55, 0.42, 0.7, 'blanco', 0, 0.21, 0.1);
  caja(g, 0.62, 0.12, 1.1, azul, 0, 0.58, 0.35);                     // asiento y piernas
  const respaldo = caja(g, 0.6, 0.1, 0.75, azul, 0, 0.78, -0.45);
  respaldo.rotation.x = 0.55;
  caja(g, 0.3, 0.1, 0.22, azul, 0, 1.02, -0.86);                     // cabecera
  for (const s of [-1, 1]) caja(g, 0.06, 0.06, 0.45, 'blanco', s * 0.35, 0.7, 0.05);
  // módulo lateral y escupidera
  caja(g, 0.45, 0.85, 0.45, 'blanco', 0.65, 0.42, -0.45);
  cilindro(g, 0.12, 0.08, '#d9e3e8', 0.65, 0.9, -0.45);
  // lámpara articulada
  cilindro(g, 0.03, 1.55, 'blanco', -0.42, 0.95, -0.85);
  const brazo = caja(g, 0.06, 0.06, 0.8, 'blanco', -0.42, 1.72, -0.5);
  brazo.rotation.x = 0.3;
  caja(g, 0.3, 0.1, 0.18, 'blanco', -0.25, 1.55, -0.2);
  caja(g, 0.24, 0.02, 0.12, 'luz', -0.25, 1.49, -0.2);
  // bandeja de instrumentos
  cilindro(g, 0.02, 0.5, 'acero', 0.5, 0.9, 0.55);
  caja(g, 0.45, 0.03, 0.32, '#e7ecef', 0.5, 1.15, 0.55);
  // taburete del estudiante y caneca roja
  const t = taburete(); t.position.set(-0.75, 0, -0.1); g.add(t);
  const caneca = cilindro(g, 0.15, 0.4, '#d32f2f', 0.75, 0.2, 0.45);
  caneca.geometry = new THREE.CylinderGeometry(0.16, 0.13, 0.4, 12);
  return g;
}

function repisaJuguetes() {
  const g = new THREE.Group();
  const verde = '#a4d65e';
  for (const y of [0.02, 0.45, 0.88]) caja(g, 1.0, 0.04, 0.4, verde, 0, y, 0);
  for (const x of [-0.48, 0.48]) caja(g, 0.04, 0.9, 0.4, verde, x, 0.45, 0);
  ['#e53935', '#fdd835', '#1e88e5', '#8e24aa', '#ff7043'].forEach((c, i) =>
    caja(g, 0.16, 0.16, 0.16, c, -0.35 + i * 0.17, i % 2 ? 0.55 : 0.12, 0));
  const peluche = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), mat('#f5f5f5'));
  peluche.position.set(0.2, 1.02, 0);
  g.add(peluche);
  return g;
}

function abaco() {
  const g = new THREE.Group();
  for (const x of [-0.4, 0.4]) caja(g, 0.05, 0.9, 0.05, '#8d5b34', x, 0.85, 0);
  for (const y of [0.4, 1.3]) caja(g, 0.85, 0.05, 0.05, '#8d5b34', 0, y, 0);
  const colores = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#e53935'];
  colores.forEach((c, r) => {
    const y = 0.5 + r * 0.115;
    cilindro(g, 0.006, 0.8, 'acero', 0, y, 0).rotation.z = PI / 2;
    for (let i = 0; i < 6; i++) {
      const cuenta = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat(c));
      cuenta.position.set(-0.3 + i * 0.055 + (r % 3) * 0.06, y, 0);
      g.add(cuenta);
    }
  });
  for (const x of [-0.4, 0.4]) caja(g, 0.06, 0.04, 0.4, '#8d5b34', x, 0.4, 0);
  return g;
}

function cadena() {
  const g = new THREE.Group();
  for (const x of [-0.6, 0.6]) {
    cilindro(g, 0.03, 0.9, 'acero', x, 0.45, 0);
    cilindro(g, 0.16, 0.03, 'negro', x, 0.015, 0);
  }
  const c = caja(g, 1.2, 0.03, 0.03, '#f2c230', 0, 0.75, 0);
  c.rotation.z = 0.05;
  return g;
}

/* ======================================================================== Texturas de muebles y decoración */
const cache = new Map();
function memo(clave, f) { if (!cache.has(clave)) cache.set(clave, f()); return cache.get(clave); }

function texturaNovaventa() {
  return memo('novaventa', () => {
    const [cv, g] = lienzo(256, 512);
    g.fillStyle = '#f2efe9'; g.fillRect(0, 0, 256, 512);
    g.fillStyle = '#c9a77c'; g.fillRect(0, 0, 256, 90);
    g.fillStyle = '#ffffff'; g.font = 'bold 36px sans-serif'; g.textAlign = 'center'; g.fillText('novaventa', 128, 48);
    g.fillStyle = '#3f9b35'; g.font = 'italic 24px sans-serif'; g.fillText('en la vía', 160, 78);
    g.fillStyle = '#2d3339'; g.fillRect(24, 110, 170, 250);
    for (let r = 0; r < 5; r++) for (let c = 0; c < 4; c++) {
      g.fillStyle = ['#e53935', '#fdd835', '#43a047', '#fb8c00', '#1e88e5'][(r + c) % 5];
      g.fillRect(34 + c * 40, 122 + r * 47, 28, 32);
    }
    g.fillStyle = '#b8bec4'; g.fillRect(204, 140, 40, 120);
    g.fillStyle = '#3f9b35'; g.fillRect(0, 380, 256, 132);
    g.fillStyle = '#ffffff'; g.font = 'bold 26px sans-serif'; g.fillText('SIEMPRE', 128, 470);
    return textura(cv, false);
  });
}

function texturaFigura() {
  return memo('figura', () => {
    const [cv, g] = lienzo(160, 400);
    g.clearRect(0, 0, 160, 400);
    g.fillStyle = '#e0b48f'; g.beginPath(); g.arc(80, 48, 28, 0, 7); g.fill();
    g.fillStyle = '#3b2a20'; g.beginPath(); g.arc(80, 36, 29, PI, 0); g.fill();
    g.fillStyle = '#b3262b'; g.fillRect(44, 80, 72, 130);
    g.strokeStyle = '#1b1b1b'; g.lineWidth = 3;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(44 + i * 14, 80); g.lineTo(44 + i * 14, 210); g.stroke(); g.beginPath(); g.moveTo(44, 90 + i * 22); g.lineTo(116, 90 + i * 22); g.stroke(); }
    g.fillStyle = '#b3262b'; g.fillRect(116, 90, 34, 18); g.fillRect(12, 90, 34, 18);
    g.fillStyle = '#1d2128'; g.fillRect(50, 210, 26, 160); g.fillRect(84, 210, 26, 160);
    g.fillStyle = '#ffffff'; g.fillRect(44, 368, 36, 18); g.fillRect(82, 368, 36, 18);
    return textura(cv, false);
  });
}

export function texturaCirculoOptico() {
  return memo('circulo', () => {
    const [cv, g] = lienzo(512, 512);
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
    return textura(cv, false);
  });
}

function texturaLogoUcc() {
  return memo('logoucc', () => {
    const [cv, g] = lienzo(256, 256);
    g.clearRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(120,125,130,0.75)'; g.lineWidth = 34;
    g.beginPath(); g.moveTo(70, 30); g.lineTo(70, 150); g.arc(120, 150, 50, PI, 0, true); g.lineTo(170, 70); g.stroke();
    g.lineWidth = 22;
    g.beginPath(); g.arc(178, 120, 40, PI * 0.35, PI * 1.65); g.stroke();
    return textura(cv, false);
  });
}

function texturaCodigoConducta() {
  return memo('codigo', () => {
    const [cv, g] = lienzo(256, 366);
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 256, 366);
    g.fillStyle = '#1f8f8a'; g.fillRect(0, 0, 256, 60); g.fillRect(0, 250, 256, 116);
    g.fillStyle = '#ffffff'; g.font = 'bold 24px sans-serif'; g.fillText('Código de Conducta', 12, 38);
    g.fillStyle = '#c62828';
    for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(22, 80 + i * 28, 9, 0, 7); g.fill(); }
    g.fillStyle = '#6b7780';
    for (let i = 0; i < 6; i++) g.fillRect(40, 76 + i * 28, 190, 6);
    return textura(cv, false);
  });
}

function texturaTablero() {
  return memo('tablero', () => {
    const [cv, g] = lienzo(256, 128);
    g.fillStyle = '#fbfbfb'; g.fillRect(0, 0, 256, 128);
    g.strokeStyle = '#9aa0a6'; g.lineWidth = 6; g.strokeRect(0, 0, 256, 128);
    g.fillStyle = '#3b6fb6'; g.font = '18px sans-serif'; g.fillText('Morfología humana', 20, 40);
    return textura(cv, false);
  });
}

function texturaMuralInfantil() {
  return memo('mural', () => {
    const [cv, g] = lienzo(512, 330);
    const gr = g.createLinearGradient(0, 0, 0, 330);
    gr.addColorStop(0, '#9fd9e8'); gr.addColorStop(1, '#bfe6a8');
    g.fillStyle = gr; g.fillRect(0, 0, 512, 330);
    g.fillStyle = '#4b2c83'; g.font = 'bold 48px "Comic Sans MS", sans-serif'; g.textAlign = 'center';
    g.strokeStyle = '#ffffff'; g.lineWidth = 8;
    g.strokeText('Clínica', 256, 66); g.fillText('Clínica', 256, 66);
    g.strokeText('Odontológica', 256, 116); g.fillText('Odontológica', 256, 116);
    const nino = (x, piel, ropa, pelo) => {
      g.fillStyle = ropa; g.fillRect(x - 32, 210, 64, 80);
      g.fillStyle = piel; g.beginPath(); g.arc(x, 180, 34, 0, 7); g.fill();
      g.fillStyle = pelo; g.beginPath(); g.arc(x, 166, 34, PI, 0); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x, 192, 14, 0, PI); g.fill();
    };
    nino(150, '#7b4a2e', '#3f9b35', '#2b1a10');
    nino(256, '#f2c9a5', '#8e5bd0', '#f6c445');
    nino(362, '#f2c9a5', '#e98ab0', '#7a4a2a');
    g.fillStyle = '#ffffff';
    for (const [x, y] of [[60, 250], [470, 230], [430, 70], [80, 80]]) { g.fillRect(x - 14, y - 40, 28, 70); g.fillStyle = '#5fb3e0'; g.fillRect(x - 14, y - 40, 28, 14); g.fillStyle = '#ffffff'; }
    g.fillStyle = '#2e7d32'; g.font = 'bold 20px sans-serif'; g.fillText('UNIVERSIDAD COOPERATIVA DE COLOMBIA', 256, 318);
    return textura(cv, false);
  });
}

function texturaEndodoncia() {
  return memo('endo', () => {
    const [cv, g] = lienzo(300, 240);
    g.fillStyle = '#28408f'; g.fillRect(0, 0, 300, 240);
    g.fillStyle = '#ffffff'; g.font = 'bold 22px sans-serif'; g.fillText('TRATAMIENTO DE', 20, 34); g.fillText('ENDODONCIA', 20, 60);
    for (let i = 0; i < 6; i++) { g.fillStyle = ['#ffd54f', '#81d4fa', '#ef9a9a'][i % 3]; g.fillRect(20 + (i % 3) * 92, 80 + Math.floor(i / 3) * 76, 80, 64); }
    return textura(cv, false);
  });
}

function texturaEstante(tipo, w, h) {
  return memo(`estante:${tipo}:${w}:${h}`, () => {
    const W = Math.round(w * 100), H = Math.round(h * 100);
    const [cv, g] = lienzo(W, H);
    g.fillStyle = tipo === 'insumos' ? '#d8d2c8' : '#3b3f43'; g.fillRect(0, 0, W, H);
    const filas = tipo === 'insumos' ? 7 : 5;
    let semilla = 5;
    const azar = () => ((semilla = (semilla * 9301 + 49297) % 233280) / 233280);
    for (let f = 0; f < filas; f++) {
      const y0 = 6 + f * (H - 12) / filas, alto = (H - 12) / filas - 8;
      g.fillStyle = tipo === 'insumos' ? '#bdb6aa' : '#25282b'; g.fillRect(4, y0 + alto, W - 8, 6);
      if (tipo === 'insumos') {
        for (let x = 6; x < W - 30; x += 26) { g.fillStyle = ['#c62828', '#c8b48a', '#e7e1d6'][Math.floor(azar() * 3)]; g.fillRect(x, y0 + 4, 22, alto - 6); g.fillStyle = '#5a5a5a'; g.fillRect(x + 8, y0 + alto / 2, 6, 4); }
      } else if (tipo === 'productos') {
        for (let x = 6; x < W - 14; x += 14 + azar() * 8) { g.fillStyle = ['#e53935', '#1e88e5', '#fdd835', '#ffffff', '#43a047', '#f48fb1'][Math.floor(azar() * 6)]; const hh = alto * (0.4 + azar() * 0.5); g.fillRect(x, y0 + alto - hh, 10, hh); }
      } else if (tipo === 'modelos') {
        for (let x = 10; x < W - 30; x += 40) { g.fillStyle = '#e8dcc8'; g.beginPath(); g.arc(x + 14, y0 + alto - 14, 12, 0, 7); g.fill(); }
      } else {
        const verde = tipo === 'historias';
        for (let x = 6; x < W - 8; x += 7) { g.fillStyle = verde ? ['#2e7d32', '#388e3c', '#1b5e20'][Math.floor(azar() * 3)] : ['#1565c0', '#f9a825', '#6d4c41', '#c62828', '#9e9e9e'][Math.floor(azar() * 5)]; g.fillRect(x, y0 + 4, 5, alto - 4); }
      }
    }
    return textura(cv, false);
  });
}
