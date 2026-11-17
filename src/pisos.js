import * as THREE from 'three';
import { ALTO, mat, lienzo, textura } from './recorrido.js';
import {
  lockers, banca, silla, escritorio, archivador, planta, canecas, cartelera, extintor,
  mesaMadera, estanteria, taburete, caja, cilindro, memo, texturaLogoUcc, texturaTablero,
} from './planos.js';

/*
 * Generador de pisos "típicos" de los bloques A y B, a partir de lo que se ve en los videos:
 * un pasillo central y, a cada lado, salones, oficinas, laboratorios, baños y escaleras.
 * Cada piso se describe con datos (qué hay a cada lado y en qué tramo) y aquí se arma:
 * muros, puertas, letreros, muebles, escaleras entre pisos y los destinos del menú "Ir a…".
 *
 * Coordenadas locales: el pasillo va a lo largo de z (de -L/2 a L/2), centrado en x = 0.
 * lado 'izq' = x negativas, 'der' = x positivas. yaw 0 mira hacia -z.
 */

const PI = Math.PI, DER = -PI / 2, IZQ = PI / 2;

/* ======================================================================== Estilos de cada bloque */
export const ESTILOS = {
  // Bloque B: ladrillo a la vista en pasillos, puertas vino, piso gris claro brillante, sillas azules
  B: { piso: 'terrazo', muro: 'blanco', pasillo: 'ladrillo', puerta: 'puertaRoja', lamparas: 'tubo',
       tuberias: true, banca: 'azul', techo: 'techo', banda: false, divisiones: 'muro' },
  // Pisos altos del B: granito beige y bancas de madera
  Balto: { piso: 'granito', muro: 'blanco', pasillo: 'ladrillo', puerta: 'puertaRoja', lamparas: 'tubo',
           tuberias: true, banca: 'madera', techo: 'techo', banda: false, divisiones: 'muro' },
  // Bloque A: muros blancos con franja de madera, techo de concreto reticular con tubería amarilla,
  // puertas de madera naranja y oficinas con divisiones de vidrio esmerilado
  A: { piso: 'beige', muro: 'blancoFranja', pasillo: 'blancoFranja', puerta: 'puertaNaranja', lamparas: 'tubo',
       tuberias: 'amarilla', banca: 'tandem', techo: 'reticular', banda: true, divisiones: 'vidrio' },
};

/* ======================================================================== API */
/**
 * Crea un nivel listo para INTERIORES a partir de su descripción.
 *  def = { id, nombre, corto, estilo, W, L, P, salas: [...], extremos: {norte, sur}, extra(k) }
 *  sala = { lado:'izq'|'der', z0, z1, tipo, nombre, letrero?, lugares?, claves?, prof?, puerta? }
 *  tipo 'escaleras' = núcleo con una escalera que sube y otra que baja (opciones sube/baja = id de piso)
 */
export function nivel(def) {
  const d = { P: 3, extremos: {}, ...def };
  return {
    id: d.id, nombre: d.nombre, corto: d.corto, estilo: { ...ESTILOS[d.estilo ?? 'B'], ...(d.estiloExtra ?? {}) },
    destinos: destinosDe(d),
    construir: (k) => construir(k, d),
  };
}

const slug = (s) => String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const signo = (lado) => (lado === 'izq' ? -1 : 1);

/** Geometría de una sala: borde del pasillo (xi), fondo (xe) y puerta. */
function geo(d, s) {
  const sg = signo(s.lado), xi = sg * d.P / 2, xe = sg * Math.min(d.W / 2, d.P / 2 + (s.prof ?? d.W / 2));
  const pz = s.puerta ?? (s.z1 - Math.min(1.4, (s.z1 - s.z0) / 2));   // puerta cerca del extremo +z
  return { sg, xi, xe, pz, x0: Math.min(xi, xe), x1: Math.max(xi, xe), cx: (xi + xe) / 2, cz: (s.z0 + s.z1) / 2,
           largo: s.z1 - s.z0, prof: Math.abs(xe - xi) };
}

function destinosDe(d) {
  const lista = [];
  const esc = d.salas.filter(s => s.tipo === 'escaleras');
  esc.forEach((s, i) => {
    const g = geo(d, s);
    lista.push({ id: 'esc' + i, nombre: esc.length > 1 ? `Escaleras ${i + 1}` : 'Escaleras', x: g.sg * 0.2, z: g.cz, yaw: g.sg > 0 ? DER : IZQ, oculto: i > 0 });
  });
  for (const s of d.salas) {
    if (s.tipo === 'escaleras' || s.tipo === 'muro' || s.sinDestino) continue;
    const g = geo(d, s);
    const abierta = s.tipo === 'abierto' || s.abierta;
    const x = abierta ? g.xi + g.sg * Math.min(1.8, g.prof / 2) : g.xi + g.sg * 1.0;
    lista.push({
      id: s.id ?? slug(s.nombre), nombre: s.nombre, x, z: abierta ? g.cz : g.pz, yaw: g.sg > 0 ? DER : IZQ,
      lugares: s.lugares, claves: s.claves, nota: s.nota, aproximado: s.aproximado,
    });
  }
  for (const e of d.destinosExtra ?? []) lista.push(e);
  return lista;
}

/* ======================================================================== Construcción */
function construir(k, d) {
  const { W, L, P } = d;
  const est = k.estilo;
  k.limitar(-W / 2 - 0.5, -L / 2 - 0.5, W / 2 + 0.5, L / 2 + 0.5);
  // Pasillo con su propio piso (vinotinto en algunos pisos del A) y salas con el piso del bloque
  k.piso(-P / 2, -L / 2, P / 2, L / 2, d.pisoPasillo);
  k.piso(-W / 2, -L / 2, -P / 2, L / 2);
  k.piso(P / 2, -L / 2, W / 2, L / 2);

  // Muros exteriores (las salas ponen sus propias ventanas)
  const extremo = (z, tipo, rot) => {
    if (tipo === 'abierto') return;
    if (tipo === 'ventanal') k.vidriera(-P / 2 - 0.2, z, P / 2 + 0.2, z, {});
    else if (tipo?.conexion) {
      k.muro(-W / 2, z, W / 2, z, { mat: est.pasillo, huecos: [[W / 2 - 0.9, W / 2 + 0.9]] });
      k.letrero([`Paso al ${tipo.conexion}`], 0, 2.55, z - Math.sign(z) * 0.1, rot, 'ucc');
      k.puerta(-0.45, z, rot, { vidrio: true, ancho: 0.9, abierta: false });
      k.puerta(0.45, z, rot + PI, { vidrio: true, ancho: 0.9, abierta: false });
      k.portal(-0.9, z - Math.sign(z) * 0.6 - 0.3, 0.9, z - Math.sign(z) * 0.6 + 0.3, tipo.nivel, tipo.llegada, tipo.edificio);
      return;
    }
    else k.muro(-W / 2, z, W / 2, z, { mat: est.pasillo, ventanas: tipo === 'ventana' ? [[W / 2 - 1.2, W / 2 + 1.2]] : [] });
  };
  extremo(-L / 2, d.extremos.norte ?? 'ventana', 0);
  extremo(L / 2, d.extremos.sur ?? 'ventana', PI);
  k.muro(-W / 2, -L / 2, -W / 2, L / 2, { mat: 'blanco' });
  k.muro(W / 2, -L / 2, W / 2, L / 2, { mat: 'blanco' });

  // Tramos del borde del pasillo sin sala → muro con ladrillo/franja
  for (const lado of ['izq', 'der']) {
    const sg = signo(lado);
    const ocupados = d.salas.filter(s => s.lado === lado).map(s => [s.z0, s.z1]).sort((a, b) => a[0] - b[0]);
    let z = -L / 2;
    for (const [a, b] of [...ocupados, [L / 2, L / 2]]) {
      if (a - z > 0.2) k.muro(sg * P / 2, z, sg * P / 2, a, { mat: est.pasillo });
      z = Math.max(z, b);
    }
  }

  for (const s of d.salas) sala(k, d, s);
  pasillo(k, d);
  d.extra?.(k);
}

/** Pasillo: lámparas, tuberías, bancas, canecas, carteleras, extintores y plantas. */
function pasillo(k, d) {
  const { L, P } = d, est = k.estilo;
  k.lamparas(0, -L / 2 + 1.5, 0, L / 2 - 1.5, { eje: 'z', paso: 3.2 });
  if (est.tuberias) {
    k.tuberias(P / 2 - 0.25, -L / 2, P / 2 - 0.25, L / 2, ALTO - 0.15, 2);
    if (est.tuberias === 'amarilla') {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, L, 8), mat('tuboAmarillo'));
      t.rotation.x = PI / 2; t.position.set(-P / 2 + 0.3, ALTO - 0.25, 0);
      k.add(t);
    }
  }
  // Mobiliario del pasillo en los tramos de muro libres (sin puertas)
  let i = 0;
  for (const lado of ['izq', 'der']) {
    const sg = signo(lado);
    const huecos = d.salas.filter(s => s.lado === lado && s.tipo !== 'muro').map(s => {
      if (s.tipo === 'escaleras' || s.tipo === 'abierto' || s.abierta) return [s.z0, s.z1];
      const g = geo(d, s); return [g.pz - 0.9, g.pz + 0.9];
    });
    for (let z = -L / 2 + 2.2; z < L / 2 - 2; z += 3.3) {
      if (huecos.some(([a, b]) => z > a - 1.4 && z < b + 1.4)) continue;
      const x = sg * (P / 2 - 0.32), rot = sg > 0 ? DER : IZQ;   // de espaldas al muro
      const tipo = (i++ + (sg > 0 ? 1 : 0)) % 4;
      if (tipo === 0) k.colocar(bancaPasillo(est.banca), x - sg * 0.02, z, rot);
      else if (tipo === 1) { k.colocar(canecas(['#2e7d32', '#9e9e9e', '#1565c0']), x, z, rot); k.colocar(extintor(), sg * (P / 2 - 0.1), z + 0.9, rot, false); }
      else if (tipo === 2) { k.colocar(cartelera(1.6, 1.0, '#2e6b4f', 'avisos'), sg * (P / 2 - 0.1), z, rot, false, 1.0); k.colocar(bancaPasillo(est.banca), x, z, rot); }
      else k.colocar(planta(), x, z, rot);
    }
  }
}

/* ---------------------------------------------------------------- salas */
function sala(k, d, s) {
  const est = k.estilo;
  const g = geo(d, s);
  const { sg, xi, xe, pz } = g;
  if (s.tipo === 'muro') return;

  // Muro hacia el pasillo, con la puerta
  if (s.tipo === 'escaleras' || s.tipo === 'abierto' || s.abierta) {
    // sin muro: se entra de frente
  } else if (est.divisiones === 'vidrio' && ['oficina', 'lab', 'labQuimica', 'innovacion', 'informatica', 'profesores', 'preclinica', 'simulacion', 'multifuncional'].includes(s.tipo)) {
    k.vidriera(xi, s.z0, xi, s.z1, { huecos: [[pz - s.z0 - 0.5, pz - s.z0 + 0.5]], esmerilado: false, banda: true });
    k.puerta(xi, pz - 0.5, sg > 0 ? PI : 0, { color: est.puerta, ancho: 1.0 });
  } else {
    k.muro(xi, s.z0, xi, s.z1, { mat: est.pasillo, huecos: [[pz - s.z0 - 0.5, pz - s.z0 + 0.5]] });
    k.puerta(xi, pz - 0.5, sg > 0 ? PI : 0, { color: est.puerta, ancho: 1.0 });
  }
  // Divisiones con las salas vecinas
  if (s.tipo !== 'abierto') {
    k.muro(xi, s.z0, xe, s.z0, { mat: s.tipo === 'escaleras' ? est.pasillo : est.muro });
    k.muro(xi, s.z1, xe, s.z1, { mat: s.tipo === 'escaleras' ? est.pasillo : est.muro });
  }
  // Ventanas al exterior
  if (Math.abs(xe) >= d.W / 2 - 0.01 && s.tipo !== 'escaleras' && s.tipo !== 'banos' && s.largo > 2) {
    const v = s.ventanas ?? 'ventana';
    if (v === 'ventanal') k.vidriera(xe, s.z0, xe, s.z1, {});
    else k.muro(xe, s.z0, xe, s.z1, { mat: 'blanco', ventanas: [[0.5, s.largo - 0.5]] });
  }
  // Letrero turquesa junto a la puerta (como los del campus)
  if (s.letrero !== false && s.tipo !== 'abierto' && s.tipo !== 'escaleras') {
    const texto = s.letrero ?? (s.numero ? [s.nombre.replace(/ \d+$/, ''), s.numero] : partir(s.nombre));
    k.letrero(texto, xi - sg * 0.1, 1.75, pz + 0.95, sg > 0 ? DER : IZQ, 'piso');
  } else if (s.tipo === 'abierto' && s.letrero !== false) {
    k.etiqueta(s.nombre, g.cx, 2.4, g.cz);
  }
  // Techo: lámparas propias
  if (s.tipo !== 'escaleras') k.lamparas(g.x0 + 1.2, s.z0 + 1.2, g.x1 - 1.2, s.z1 - 1.2, { eje: 'z', paso: 2.6, tipo: est.techo === 'reticular' ? 'tubo' : 'panel' });

  (s.muebles ?? MUEBLES[s.tipo] ?? MUEBLES.oficina)(k, g, s, d);
  k.zona(s.id ?? slug(s.nombre), g.x0, s.z0, g.x1, s.z1);
}

function partir(nombre) {
  const p = nombre.split(' ');
  if (nombre.length < 18 || p.length < 3) return [nombre];
  const m = Math.ceil(p.length / 2);
  return [p.slice(0, m).join(' '), p.slice(m).join(' ')];
}

/* ======================================================================== Muebles por tipo de sala */
const MUEBLES = {
  /** Salón de clase: sillas universitarias turquesa con brazo, escritorio, tablero y proyector. */
  salon(k, g, s) {
    const { sg, xi, xe } = g;
    const frenteZ = s.z0 + 0.5;                       // el tablero en el muro de -z
    k.colocar(tableroBlanco(Math.min(3.6, g.prof - 2)), g.cx, s.z0 + 0.1, 0, false, 0.9);
    k.colocar(escritorioProfesor(), g.cx + sg * (g.prof / 2 - 1.6), frenteZ + 1.0, 0);
    k.colocar(proyectorTecho(), g.cx, s.z0 + g.largo / 2, 0, false, ALTO - 0.5);
    const filasZ = [];
    for (let z = frenteZ + 2.2; z < s.z1 - 0.9; z += 0.95) filasZ.push(z);
    // Filas de sillas desde la ventana hasta dejar un pasillo de 1.6 m junto a la puerta
    const lejos = xe - sg * 0.8, cerca = xi + sg * 1.7;
    const xa = Math.min(lejos, cerca), xb = Math.max(lejos, cerca);
    filasZ.forEach((z, fi) => {
      for (let x = xa + (fi % 2) * 0.05; x <= xb; x += 0.78)
        k.colocar(sillaUniversitaria(s.silla ?? '#1aa0a8'), x, z, 0, false);
    });
    if (filasZ.length && xb > xa) k.obstaculo(xa - 0.3, filasZ[0] - 0.35, xb + 0.35, filasZ.at(-1) + 0.35);
    cortinas(k, g, s);
  },

  /** Oficina: puestos con computador, archivadores y sillas de espera. */
  oficina(k, g, s) {
    const n = Math.max(1, Math.min(4, Math.floor(g.largo / 2.4)));
    for (let i = 0; i < n; i++) {
      const z = s.z0 + 1.4 + i * ((g.largo - 2.2) / Math.max(1, n - 1 || 1));
      k.colocar(escritorio(), g.xe - g.sg * 1.2, Math.min(z, s.z1 - 1.2), g.sg > 0 ? DER : IZQ);
    }
    k.colocar(archivador(), g.xi + g.sg * 0.5, s.z0 + 0.4, 0);
    if (g.largo > 4) k.colocar(archivador(), g.xi + g.sg * 1.1, s.z0 + 0.4, 0);
    k.colocar(planta(), g.xe - g.sg * 0.5, s.z1 - 0.5, 0);
    if (s.logo) k.imagen(texturaLogoUcc(), 1.2, 1.2, g.cx, 1.7, s.z0 + 0.1, 0);
  },

  /** Decanatura / facultad: recepción, oficinas y sala de espera. */
  facultad(k, g, s) {
    MUEBLES.oficina(k, g, s);
    k.colocar(mostrador(2.2), g.xi + g.sg * 1.8, g.pz - 1.8, g.sg > 0 ? DER : IZQ);
    k.colocar(bancaPasillo('azul', 3), g.xi + g.sg * 0.45, s.z0 + 2.6, g.sg > 0 ? IZQ : DER);
    k.imagen(texturaLogoUcc(), 1.1, 1.1, g.cx, 1.8, s.z0 + 0.1, 0);
  },

  /** Sala de profesores: mesa larga, sillas, lockers y casilleros. */
  profesores(k, g, s) {
    const largo = Math.min(g.largo - 2.2, 5);
    k.colocar(mesaMadera(1.2, largo, '#c9a571'), g.cx, g.cz, 0);
    for (let z = g.cz - largo / 2 + 0.5; z < g.cz + largo / 2; z += 0.8)
      for (const sx of [-1, 1]) k.colocar(silla('#2b2e33'), g.cx + sx * 0.85, z, sx > 0 ? DER : IZQ, false);
    k.colocar(lockers({ cols: 4, filas: 4, tipo: 'metal' }), g.xe - g.sg * 0.3, s.z0 + 1.2, g.sg > 0 ? IZQ : DER);
    k.colocar(escritorio(), g.xe - g.sg * 1.1, s.z1 - 1.2, g.sg > 0 ? DER : IZQ);
  },

  /** Sala de informática: mesas largas en filas con computadores. */
  informatica(k, g, s) {
    const filas = [];
    for (let z = s.z0 + 1.6; z < s.z1 - 1.2; z += 1.7) filas.push(z);
    const ancho = g.prof - 2.2;
    for (const z of filas) {
      k.colocar(mesaComputadores(ancho, Math.max(2, Math.floor(ancho / 0.9))), g.cx + g.sg * 0.3, z, 0);
      for (let x = -ancho / 2 + 0.45; x < ancho / 2; x += 0.9) k.colocar(silla('#1f2a36'), g.cx + g.sg * 0.3 + x, z + 0.6, PI, false);
    }
    k.colocar(tableroBlanco(2.6), g.cx, s.z0 + 0.1, 0, false, 0.9);
    k.colocar(televisor(), g.cx + g.sg * 2.2, s.z0 + 0.15, 0, false, 1.4);
  },

  /** Laboratorio genérico: mesones blancos con lavaplatos y banquetas. */
  lab(k, g, s) {
    const filas = [];
    for (let z = s.z0 + 1.8; z < s.z1 - 1.5; z += 2.4) filas.push(z);
    const ancho = Math.min(g.prof - 2.4, 6);
    for (const z of filas) {
      k.colocar(mesonLab(ancho), g.cx + g.sg * 0.4, z, 0);
      for (let x = -ancho / 2 + 0.4; x < ancho / 2; x += 0.8)
        for (const dz of [-0.75, 0.75]) k.colocar(taburete(), g.cx + g.sg * 0.4 + x, z + dz, 0, false);
    }
    k.colocar(gabineteLab(), g.xe - g.sg * 0.35, s.z0 + 1.2, g.sg > 0 ? IZQ : DER);
    k.colocar(lavamanosLab(), g.xe - g.sg * 0.35, s.z1 - 1.0, g.sg > 0 ? IZQ : DER);
    k.colocar(tableroBlanco(2.4), g.cx, s.z0 + 0.1, 0, false, 0.9);
  },

  /** Laboratorio de operaciones: mesones de acero con lavaplatos largos bajo el ventanal. */
  operaciones(k, g, s) {
    k.colocar(lavaplatosLargo(g.largo - 1.6), g.xe - g.sg * 0.45, g.cz, g.sg > 0 ? IZQ : DER);
    k.colocar(gabineteLab(), g.xi + g.sg * 0.5, s.z0 + 0.8, g.sg > 0 ? DER : IZQ);
    for (let z = s.z0 + 2; z < s.z1 - 1.5; z += 2.6) k.colocar(mesaAceroLarga(2.4), g.cx, z, 0);
  },

  /** Laboratorio de Innovación, Prototipado y Emprendimiento: mesas blancas e impresoras 3D. */
  innovacion(k, g, s) {
    for (let z = s.z0 + 1.6; z < s.z1 - 1.6; z += 2.2) {
      k.colocar(mesaBlanca(2.4, 1.0), g.cx - g.sg * 0.6, z, 0);
      for (const dx of [-0.7, 0.7]) k.colocar(silla('#26292c'), g.cx - g.sg * 0.6 + dx, z + 0.75, PI, false);
    }
    k.colocar(mesaBlanca(g.largo - 2, 0.75), g.xe - g.sg * 0.5, g.cz, g.sg > 0 ? IZQ : DER);
    for (let z = s.z0 + 1.6; z < s.z1 - 1; z += 1.2) k.colocar(impresora3D(), g.xe - g.sg * 0.5, z, 0, false, 0.78);
    k.colocar(panelRojo(), g.cx + g.sg * 1.5, s.z1 - 0.15, PI, false);
  },

  /** Preclínica de Odontología: mesones con cabezas de simulación. */
  preclinica(k, g, s) {
    for (let z = s.z0 + 1.6; z < s.z1 - 1.4; z += 2.2) {
      k.colocar(mesonLab(g.prof - 2.6, false), g.cx + g.sg * 0.4, z, 0);
      for (let x = -(g.prof - 2.6) / 2 + 0.5; x < (g.prof - 2.6) / 2; x += 0.9) {
        k.colocar(cabezaSimulacion(), g.cx + g.sg * 0.4 + x, z - 0.25, 0, false, 0.92);
        k.colocar(taburete(), g.cx + g.sg * 0.4 + x, z + 0.7, 0, false);
      }
    }
    k.colocar(tableroBlanco(2.6), g.cx, s.z0 + 0.1, 0, false, 0.9);
    k.colocar(televisor(), g.cx + g.sg * 2.2, s.z0 + 0.15, 0, false, 1.4);
  },

  /** Simulación clínica: camillas con maniquíes. */
  simulacion(k, g, s) {
    for (let z = s.z0 + 1.6; z < s.z1 - 1.2; z += 2.4) {
      k.colocar(camilla(), g.xe - g.sg * 1.3, z, g.sg > 0 ? IZQ : DER);
      k.colocar(cortinaClinica(2.2), g.xe - g.sg * 1.3, z + 1.2, 0, false);
    }
    k.colocar(gabineteLab(), g.xi + g.sg * 0.5, s.z0 + 0.8, g.sg > 0 ? DER : IZQ);
  },

  /** Laboratorio multifuncional: mesas redondas blancas. */
  multifuncional(k, g, s) {
    for (let z = s.z0 + 1.8; z < s.z1 - 1.4; z += 2.3)
      for (let x = Math.min(g.xi, g.xe) + 2.4; x < Math.max(g.xi, g.xe) - 1.6; x += 2.4) {
        k.colocar(mesaRedonda(0.6, '#f2f2f0'), x, z, 0);
        alrededor(k, x, z, 0.85, () => silla('#3a4048'));
      }
    k.colocar(tableroBlanco(2.6), g.cx, s.z0 + 0.1, 0, false, 0.9);
  },

  /** Auditorio: tarima, pantalla y filas de sillas negras. */
  auditorio(k, g, s) {
    const tz = s.z0 + 1.4;
    k.colocar(tarima(g.prof - 1.2, 2.2), g.cx, tz, 0);
    k.colocar(pantalla(Math.min(5, g.prof - 3)), g.cx, s.z0 + 0.12, 0, false, 1.0);
    k.colocar(atril(), g.cx + g.sg * (g.prof / 2 - 1.6), tz + 0.4, 0, false, 0.3);
    if (s.muroColor) k.caja(0.05, ALTO, g.largo, s.muroColor, g.xe - g.sg * 0.12, ALTO / 2, g.cz);
    const filas = [];
    for (let z = tz + 2.2; z < s.z1 - 1.0; z += 0.95) filas.push(z);
    // pasillo libre de 1.6 m junto a la entrada
    const x0 = g.sg > 0 ? g.xi + 1.7 : g.xe + 0.9, x1 = g.sg > 0 ? g.xe - 0.9 : g.xi - 1.7;
    for (const z of filas)
      for (let x = x0; x < x1; x += 0.6) {
        if (Math.abs(x - g.cx) < 0.5) continue;                  // pasillo central
        k.colocar(sillaAuditorio(), x, z, 0, false);
      }
    if (filas.length) {
      k.obstaculo(x0 - 0.3, filas[0] - 0.3, g.cx - 0.5, filas.at(-1) + 0.3);
      k.obstaculo(g.cx + 0.5, filas[0] - 0.3, x1 + 0.3, filas.at(-1) + 0.3);
    }
    cortinas(k, g, s, '#2f2a28');
  },

  /** Salas de audiencia (Derecho): estrado de madera, mesas de las partes y público. */
  audiencias(k, g, s) {
    k.colocar(estrado(Math.min(3.6, g.prof - 2)), g.cx, s.z0 + 1.0, 0);
    k.imagen(texturaLogoUcc(), 0.9, 0.9, g.cx, 2.1, s.z0 + 0.1, 0);
    for (const dx of [-1.3, 1.3]) {
      k.colocar(mesaMadera(1.6, 0.7, '#7b4a2a'), g.cx + dx, s.z0 + 3.2, 0);
      k.colocar(silla('#3a2a20'), g.cx + dx - 0.35, s.z0 + 3.8, PI, false);
      k.colocar(silla('#3a2a20'), g.cx + dx + 0.35, s.z0 + 3.8, PI, false);
    }
    for (let z = s.z0 + 5; z < s.z1 - 1; z += 1.0) k.colocar(bancaPasillo('madera', 4), g.cx, z, PI);
  },

  /** Baños: lavamanos con espejo y cubículos. */
  banos(k, g, s) {
    const n = Math.max(2, Math.floor((g.largo - 1.2) / 1.0));
    for (let i = 0; i < n; i++) k.colocar(cubiculo(), g.xe - g.sg * 0.75, s.z0 + 0.7 + i * 1.0, g.sg > 0 ? IZQ : DER);
    k.colocar(lavamanosDoble(), g.xi + g.sg * 0.45, s.z0 + 1.2, g.sg > 0 ? DER : IZQ);
    const mujeres = /mujer/i.test(s.nombre);
    k.letrero([mujeres ? 'Baño mujeres' : 'Baño hombres'], g.xi - g.sg * 0.1, 2.35, g.pz + 0.95, g.sg > 0 ? DER : IZQ, 'banos');
  },

  /** Núcleo de escaleras: una sube y otra baja, cada una lleva al piso vecino. */
  escaleras(k, g, s, d) {
    const idx = d.salas.filter(x => x.tipo === 'escaleras').indexOf(s);
    const xa = g.xi + g.sg * 0.35, ancho = Math.min(1.5, (g.prof - 1.0) / 2);
    const flujo = [];
    if (s.sube != null) flujo.push(['sube', s.sube]);
    if (s.baja != null) flujo.push(['baja', s.baja]);
    flujo.forEach(([dir, destino], i) => {
      const xA = xa + g.sg * (i * (ancho + 0.25)), xB = xA + g.sg * ancho;
      const x0 = Math.min(xA, xB), x1 = Math.max(xA, xB);
      const zIni = s.z1 - 1.0, zFin = zIni - 5.4;
      k.escalera(x0, x1, zIni, zFin, dir, { barandas: [true, true] });
      k.portal(x0, zFin + 0.2, x1, zFin + 1.6, destino, 'esc' + idx, s.edificio);
      k.letrero([dir === 'sube' ? 'Sube' : 'Baja', `al ${nombreNivel(destino)}`], (x0 + x1) / 2, 2.55, zIni + 0.6, 0, 'piso');
    });
    k.colocar(planta(), g.xe - g.sg * 0.45, s.z1 - 0.45, 0);
  },

  /** Zona abierta (sin muro hacia el pasillo): puffs, mesas, lockers... */
  abierto(k, g, s) {
    (ZONAS[s.zona] ?? (() => {}))(k, g, s);
  },
};

/** Contenidos de las zonas abiertas. */
const ZONAS = {
  lockers(k, g, s) {
    for (let z = s.z0 + 0.9; z < s.z1 - 0.8; z += 1.7) k.colocar(lockers({ cols: 4, filas: 4 }), g.xe - g.sg * 0.3, z, g.sg > 0 ? IZQ : DER);
  },
  espera(k, g, s) {
    for (let z = s.z0 + 1.2; z < s.z1 - 1; z += 1.4) k.colocar(bancaPasillo(k.estilo.banca, 4), g.cx, z, PI);
  },
  puffs(k, g, s) {
    for (let i = 0; i < 9; i++) k.colocar(puff(), g.cx + ((i % 3) - 1) * 1.3 + (i % 2) * 0.2, s.z0 + 1.2 + Math.floor(i / 3) * 1.5, i, false);
  },
  pingpong(k, g, s) {
    for (let z = s.z0 + 2; z < s.z1 - 1.6; z += 3.2) k.colocar(mesaPingPong(), g.cx, z, 0);
    k.colocar(mesaRedonda(0.5, '#f0f0ee'), g.xe - g.sg * 1, s.z1 - 1, 0);
  },
  gimnasio(k, g, s) {
    for (let z = s.z0 + 1.2; z < s.z1 - 1; z += 1.2) k.colocar(caminadora(), g.xe - g.sg * 1.2, z, g.sg > 0 ? IZQ : DER);
    for (let z = s.z0 + 1.2; z < s.z1 - 1; z += 1.1) k.colocar(bicicletaEstatica(), g.cx - g.sg * 0.6, z, g.sg > 0 ? IZQ : DER);
    k.caja(g.x1 - g.x0 - 0.2, 0.02, s.z1 - s.z0 - 0.2, '#2b2e31', g.cx, 0.01, g.cz);
  },
  mesas(k, g, s) {
    for (let z = s.z0 + 1.5; z < s.z1 - 1; z += 2.2)
      for (let x = g.x0 + 1.4; x < g.x1 - 1; x += 2.4) {
        k.colocar(mesaRedonda(0.55, '#c9a26b'), x, z, 0);
        alrededor(k, x, z, 0.8, () => silla('#9aa5ae', 'plastica'));
      }
  },
  balcon(k, g, s) {
    k.colocar(baranda(g.largo), g.xe - g.sg * 0.1, g.cz, IZQ, true);
    k.colocar(planta(), g.xi + g.sg * 0.5, s.z0 + 0.5, 0);
  },
  backing(k, g, s) {
    k.imagen(texturaBacking(), g.largo - 0.4, 2.6, g.xe - g.sg * 0.1, 1.4, g.cz, g.sg > 0 ? IZQ : DER);
    k.colocar(mesaMadera(1.4, 0.6, '#c9a571'), g.cx, g.cz, 0);
  },
};

/** Cuatro sillas mirando hacia el centro de una mesa. */
function alrededor(k, x, z, r, crear) {
  for (let a = 0; a < 4; a++) {
    const ang = a * PI / 2, dx = Math.cos(ang) * r, dz = Math.sin(ang) * r;
    k.colocar(crear(), x + dx, z + dz, Math.atan2(-dx, -dz), false);
  }
}

/* ---------------------------------------------------------------- nombres de pisos */
const NOMBRES = { '-2': 'Sótano 2', '-1': 'Piso 0', 0: 'Piso 0' };
export function nombreNivel(id) { return NOMBRES[id] ?? `Piso ${id}`; }

/* ======================================================================== Muebles nuevos */
function sillaUniversitaria(color) {
  return memo('su:' + color, () => {
    const g = new THREE.Group();
    caja(g, 0.44, 0.05, 0.42, color, 0, 0.45, 0);                      // asiento
    caja(g, 0.44, 0.38, 0.05, color, 0, 0.72, 0.2);                    // espaldar
    caja(g, 0.3, 0.03, 0.42, '#d9c7a4', 0.27, 0.72, -0.05);            // brazo-mesa
    for (const [x, z] of [[-0.19, -0.17], [0.19, -0.17], [-0.19, 0.18], [0.19, 0.18]]) caja(g, 0.025, 0.45, 0.025, 'marco', x, 0.225, z);
    caja(g, 0.025, 0.28, 0.025, 'marco', 0.36, 0.58, -0.15);
    return g;
  }).clone();
}
function escritorioProfesor() {
  const g = new THREE.Group();
  caja(g, 1.4, 0.05, 0.7, '#b98f5e', 0, 0.75, 0);
  caja(g, 1.36, 0.6, 0.03, '#a07a4d', 0, 0.45, 0.3);
  for (const x of [-0.66, 0.66]) caja(g, 0.04, 0.73, 0.66, 'marco', x, 0.37, 0);
  caja(g, 0.34, 0.22, 0.02, 'negro', -0.2, 0.92, -0.05);
  g.add(silla('#2b2e33'));
  g.children.at(-1).position.set(0, 0, -0.6);
  return g;
}
function tableroBlanco(w) {
  const g = new THREE.Group();
  caja(g, w, 1.2, 0.03, '#fbfbfb', 0, 0.6, 0.02);
  caja(g, w + 0.06, 0.04, 0.05, 'acero', 0, 1.22, 0.02);
  caja(g, w + 0.06, 0.04, 0.05, 'acero', 0, -0.02, 0.02);
  caja(g, w * 0.6, 0.03, 0.08, 'acero', 0, 0.0, 0.06);
  return g;
}
function proyectorTecho() {
  const g = new THREE.Group();
  caja(g, 0.04, 0.4, 0.04, 'negro', 0, 0.2, 0);
  caja(g, 0.38, 0.12, 0.3, '#e9ebec', 0, -0.03, 0);
  cilindro(g, 0.04, 0.04, 'negro', 0, -0.03, -0.16, 10).rotation.x = PI / 2;
  return g;
}
function televisor() {
  const g = new THREE.Group();
  caja(g, 1.4, 0.8, 0.06, '#121416', 0, 0, 0);
  caja(g, 1.32, 0.72, 0.01, '#1e2a36', 0, 0, 0.035);
  return g;
}
function mostrador(w) {
  const g = new THREE.Group();
  caja(g, w, 1.05, 0.6, '#d8cdb8', 0, 0.52, 0);
  caja(g, w + 0.1, 0.04, 0.7, '#b98f5e', 0, 1.07, 0);
  caja(g, 0.4, 0.28, 0.03, 'negro', 0.4, 1.25, 0.1);
  return g;
}
function bancaPasillo(tipo = 'azul', n = 3) {
  if (tipo === 'madera') {
    const g = new THREE.Group();
    const w = n * 0.5;
    caja(g, w, 0.05, 0.42, '#a8693a', 0, 0.44, 0);
    caja(g, w, 0.32, 0.04, '#a8693a', 0, 0.68, 0.2);
    for (const x of [-w / 2 + 0.08, w / 2 - 0.08]) { caja(g, 0.06, 0.44, 0.38, '#7b4a28', x, 0.22, 0); }
    return g;
  }
  return banca(n, tipo === 'tandem' ? '#2c7f86' : '#2f55c8');
}
function mesaComputadores(w, n) {
  const g = new THREE.Group();
  caja(g, w, 0.04, 0.75, '#e2d4b8', 0, 0.74, 0);
  caja(g, w, 0.55, 0.03, '#9aa2a8', 0, 0.45, -0.35);
  for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) caja(g, 0.05, 0.72, 0.7, 'marco', x, 0.36, 0);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + (i + 0.5) * (w / n);
    caja(g, 0.5, 0.32, 0.03, '#141618', x, 1.0, -0.15);
    caja(g, 0.46, 0.28, 0.01, '#23415e', x, 1.0, -0.13);
    caja(g, 0.05, 0.1, 0.05, '#141618', x, 0.81, -0.17);
    caja(g, 0.4, 0.02, 0.14, '#2a2d30', x, 0.77, 0.1);
  }
  return g;
}
function mesonLab(w, lavaplatos = true) {
  const g = new THREE.Group();
  caja(g, w, 0.86, 0.9, '#e9ecee', 0, 0.43, 0);
  caja(g, w + 0.04, 0.05, 0.94, '#f5f6f6', 0, 0.885, 0);
  if (lavaplatos) {
    caja(g, 0.5, 0.02, 0.38, '#9da6ac', w / 2 - 0.5, 0.915, 0);
    const llave = cilindro(g, 0.015, 0.35, 'acero', w / 2 - 0.5, 1.08, -0.25, 6);
    llave.rotation.x = 0.3;
  }
  for (let x = -w / 2 + 0.6; x < w / 2 - 0.3; x += 0.9) caja(g, 0.02, 0.6, 0.01, '#c9ced2', x, 0.45, 0.455);
  return g;
}
function gabineteLab() {
  const g = new THREE.Group();
  caja(g, 1.6, 2.0, 0.5, '#e6e9eb', 0, 1.0, 0);
  caja(g, 1.5, 1.0, 0.02, 'vidrio', 0, 1.45, 0.26);
  for (let y = 1.1; y < 1.95; y += 0.4) caja(g, 1.5, 0.02, 0.45, '#cfd5d9', 0, y, 0);
  return g;
}
function lavamanosLab() {
  const g = new THREE.Group();
  caja(g, 1.2, 0.86, 0.6, '#e9ecee', 0, 0.43, 0);
  caja(g, 0.6, 0.04, 0.4, '#9da6ac', 0, 0.88, 0);
  return g;
}
function lavaplatosLargo(w) {
  const g = new THREE.Group();
  caja(g, w, 0.86, 0.65, '#d7dbde', 0, 0.43, 0);
  caja(g, w, 0.04, 0.7, 'acero', 0, 0.88, 0);
  for (let x = -w / 2 + 0.8; x < w / 2; x += 1.6) caja(g, 0.7, 0.03, 0.45, '#7f878d', x, 0.9, 0);
  caja(g, 0.9, 0.7, 0.5, '#f4f4f2', -w / 2 + 0.6, 1.3, 0.1);
  return g;
}
function mesaAceroLarga(w) {
  const g = new THREE.Group();
  caja(g, w, 0.04, 0.8, 'acero', 0, 0.9, 0);
  caja(g, w - 0.1, 0.03, 0.7, 'acero', 0, 0.25, 0);
  for (const [x, z] of [[-w / 2 + 0.05, -0.35], [w / 2 - 0.05, -0.35], [-w / 2 + 0.05, 0.35], [w / 2 - 0.05, 0.35]]) caja(g, 0.04, 0.9, 0.04, 'acero', x, 0.45, z);
  return g;
}
function mesaBlanca(w, d) {
  const g = new THREE.Group();
  caja(g, w, 0.04, d, '#f4f5f5', 0, 0.75, 0);
  for (const [x, z] of [[-w / 2 + 0.05, -d / 2 + 0.05], [w / 2 - 0.05, -d / 2 + 0.05], [-w / 2 + 0.05, d / 2 - 0.05], [w / 2 - 0.05, d / 2 - 0.05]]) caja(g, 0.04, 0.73, 0.04, 'marco', x, 0.37, z);
  return g;
}
function impresora3D() {
  const g = new THREE.Group();
  caja(g, 0.42, 0.04, 0.42, '#202326', 0, 0.02, 0);
  for (const x of [-0.19, 0.19]) caja(g, 0.03, 0.5, 0.03, '#202326', x, 0.27, 0);
  caja(g, 0.42, 0.04, 0.05, '#202326', 0, 0.52, 0);
  caja(g, 0.08, 0.08, 0.08, '#e53935', 0.05, 0.44, 0);
  caja(g, 0.3, 0.02, 0.3, '#cfd5d9', 0, 0.12, 0);
  return g;
}
function panelRojo() {
  const g = new THREE.Group();
  caja(g, 1.4, 2.2, 0.06, '#d32f2f', 0, 1.1, 0);
  return g;
}
function cabezaSimulacion() {
  return memo('cabeza', () => {
    const g = new THREE.Group();
    cilindro(g, 0.04, 0.18, 'acero', 0, 0.09, 0, 8);
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), mat('#e9c8a8'));
    c.scale.set(1, 1.2, 1); c.position.y = 0.3; g.add(c);
    caja(g, 0.18, 0.05, 0.12, '#f3f3f3', 0, 0.22, 0.04);
    return g;
  }).clone();
}
function camilla() {
  const g = new THREE.Group();
  caja(g, 0.8, 0.12, 1.9, '#f3f5f6', 0, 0.75, 0);
  caja(g, 0.82, 0.04, 1.92, 'acero', 0, 0.67, 0);
  for (const [x, z] of [[-0.35, -0.85], [0.35, -0.85], [-0.35, 0.85], [0.35, 0.85]]) caja(g, 0.04, 0.67, 0.04, 'acero', x, 0.33, z);
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 1.0, 4, 8), mat('#e9c8a8'));
  m.rotation.x = PI / 2; m.position.set(0, 0.95, 0.05); g.add(m);
  return g;
}
function cortinaClinica(w) {
  const g = new THREE.Group();
  caja(g, w, 1.9, 0.02, '#cfe3e8', 0, 1.2, 0);
  caja(g, w, 0.03, 0.03, 'acero', 0, 2.2, 0);
  return g;
}
function mesaRedonda(r, color) {
  const g = new THREE.Group();
  cilindro(g, r, 0.04, color, 0, 0.74, 0, 24);
  cilindro(g, 0.04, 0.72, 'marco', 0, 0.36, 0, 8);
  cilindro(g, 0.26, 0.03, 'marco', 0, 0.015, 0, 12);
  return g;
}
function tarima(w, d) {
  const g = new THREE.Group();
  caja(g, w, 0.3, d, '#5a4030', 0, 0.15, 0);
  return g;
}
function pantalla(w) {
  const g = new THREE.Group();
  caja(g, w, w * 0.5, 0.03, '#f8f8f8', 0, w * 0.25, 0.02);
  caja(g, w + 0.1, 0.08, 0.1, '#2b2e33', 0, w * 0.5 + 0.04, 0.02);
  return g;
}
function atril() {
  const g = new THREE.Group();
  caja(g, 0.55, 1.05, 0.45, '#6b4a33', 0, 0.52, 0);
  caja(g, 0.6, 0.04, 0.5, '#5a3d28', 0, 1.07, -0.02);
  return g;
}
function sillaAuditorio() {
  return memo('saud', () => {
    const g = new THREE.Group();
    caja(g, 0.5, 0.08, 0.46, '#1e2124', 0, 0.45, 0);
    caja(g, 0.5, 0.5, 0.07, '#1e2124', 0, 0.78, 0.22);
    for (const x of [-0.27, 0.27]) caja(g, 0.04, 0.6, 0.46, '#3a3e42', x, 0.3, 0.02);
    return g;
  }).clone();
}
function estrado(w) {
  const g = new THREE.Group();
  caja(g, w, 0.25, 1.4, '#6b4426', 0, 0.12, 0);
  caja(g, w - 0.4, 1.0, 0.6, '#7b4a2a', 0, 0.75, 0.3);
  caja(g, w - 0.3, 0.05, 0.7, '#5a3820', 0, 1.27, 0.3);
  for (const x of [-0.8, 0, 0.8]) { const s = silla('#2b1f17'); s.position.set(x, 0.25, -0.35); g.add(s); }
  return g;
}
function cubiculo() {
  const g = new THREE.Group();
  caja(g, 0.03, 2.0, 1.4, '#c9ced3', -0.48, 1.1, 0);
  caja(g, 0.03, 2.0, 1.4, '#c9ced3', 0.48, 1.1, 0);
  caja(g, 0.94, 2.0, 0.03, '#d7dbdf', 0, 1.1, 0.7);
  const s = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.16, 0.4, 12), mat('#f6f6f6'));
  s.position.set(0, 0.2, -0.4); g.add(s);
  return g;
}
function lavamanosDoble() {
  const g = new THREE.Group();
  caja(g, 1.8, 0.1, 0.55, '#d9d4cc', 0, 0.85, 0);
  for (const x of [-0.45, 0.45]) caja(g, 0.4, 0.03, 0.32, '#f7f7f7', x, 0.9, 0);
  caja(g, 1.8, 0.9, 0.02, '#c7d6dd', 0, 1.6, -0.27);
  return g;
}
function puff() {
  const g = new THREE.Group();
  const p = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), mat('#1f3a8a'));
  p.scale.set(1, 0.5, 1.1); p.position.y = 0.25; g.add(p);
  return g;
}
function mesaPingPong() {
  const g = new THREE.Group();
  caja(g, 1.52, 0.04, 2.74, '#1d4f91', 0, 0.76, 0);
  caja(g, 1.52, 0.005, 0.02, '#ffffff', 0, 0.785, 0);
  caja(g, 0.01, 0.005, 2.74, '#ffffff', 0, 0.785, 0);
  caja(g, 1.7, 0.15, 0.02, '#e8e8e8', 0, 0.86, 0);
  for (const z of [-1.1, 1.1]) caja(g, 1.2, 0.74, 0.06, '#2b2e33', 0, 0.37, z);
  return g;
}
function caminadora() {
  const g = new THREE.Group();
  caja(g, 0.75, 0.2, 1.8, '#2a2d30', 0, 0.1, 0);
  caja(g, 0.55, 0.02, 1.5, '#111', 0, 0.21, 0);
  for (const x of [-0.33, 0.33]) caja(g, 0.05, 1.2, 0.05, '#4a4f54', x, 0.8, -0.8);
  caja(g, 0.75, 0.25, 0.25, '#3a3e42', 0, 1.35, -0.85);
  return g;
}
function bicicletaEstatica() {
  const g = new THREE.Group();
  caja(g, 0.5, 0.06, 1.1, '#2a2d30', 0, 0.03, 0);
  caja(g, 0.08, 0.8, 0.08, '#c62828', 0, 0.45, 0.2);
  caja(g, 0.25, 0.06, 0.3, '#111', 0, 0.88, 0.25);
  caja(g, 0.08, 1.0, 0.08, '#c62828', 0, 0.6, -0.35);
  cilindro(g, 0.25, 0.08, '#4a4f54', 0, 0.3, -0.35, 16).rotation.z = PI / 2;
  return g;
}
function baranda(L) {
  const g = new THREE.Group();
  caja(g, L, 0.05, 0.05, 'marco', 0, 1.05, 0);
  for (let x = -L / 2; x <= L / 2; x += 1.2) caja(g, 0.04, 1.05, 0.04, 'marco', x, 0.52, 0);
  caja(g, L, 1.0, 0.02, 'vidrio', 0, 0.55, 0);
  return g;
}
function cortinas(k, g, s, color = '#9aa3a8') {
  if (Math.abs(g.xe) < 1) return;
  for (let z = s.z0 + 0.8; z < s.z1 - 0.6; z += 2.2) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.5, 0.7), mat(color));
    c.position.set(g.xe - g.sg * 0.15, 1.85, z);
    k.add(c);
  }
}

function texturaBacking() {
  return memo('backing', () => {
    const [cv, g] = lienzo(512, 256);
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 512, 256);
    g.font = 'bold 18px sans-serif';
    for (let y = 18; y < 256; y += 36)
      for (let x = (y / 36) % 2 ? 0 : 50; x < 512; x += 100) {
        g.fillStyle = '#00a9c6'; g.fillRect(x, y - 12, 14, 18);
        g.fillStyle = '#80bb27'; g.fillRect(x + 6, y - 12, 8, 18);
        g.fillStyle = '#5b5f63'; g.fillText('UCC', x + 20, y + 4);
      }
    return textura(cv, false);
  });
}

export { texturaTablero };
