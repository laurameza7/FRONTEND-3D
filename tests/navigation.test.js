import { describe, test, expect } from 'vitest';
import { INTERIORES } from '../src/planos.js';
import { destinoDeLugar, destinoEnTexto, tieneInterior } from '../src/recorrido.js';
import { nombreNivel } from '../src/bloques.js';
import lugares from './lugares-bd.json';

describe('Interiores de los bloques A y B', () => {
  test('existen los dos bloques con su piso de inicio', () => {
    expect(tieneInterior('A')).toBe(true);
    expect(tieneInterior('B')).toBe(true);
    expect(tieneInterior('X')).toBe(false);
    for (const ed of Object.values(INTERIORES))
      expect(ed.niveles.some(n => n.id === ed.inicio)).toBe(true);
  });

  test('el Bloque A tiene 7 niveles y el Bloque B 9 (con sótanos)', () => {
    expect(INTERIORES.A.niveles.map(n => n.id)).toEqual([6, 5, 4, 3, 2, 1, -1]);
    expect(INTERIORES.B.niveles.map(n => n.id)).toEqual([7, 6, 5, 4, 3, 2, 1, -1, -2]);
  });

  test.each(Object.entries(INTERIORES).flatMap(([c, e]) => e.niveles.map(n => [c, n])))(
    'Bloque %s nivel con destinos únicos y bien formados', (_, n) => {
      const ids = n.destinos.map(d => d.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const d of n.destinos) {
        expect(typeof d.nombre).toBe('string');
        expect(Number.isFinite(d.x) && Number.isFinite(d.z)).toBe(true);
      }
      expect(n.destinos.filter(d => !d.oculto).length).toBeGreaterThan(0);
      expect(typeof n.construir).toBe('function');
    });
});

describe('Cada lugar de la base de datos tiene a dónde llevar', () => {
  test.each(lugares.map(l => [l.edificio, l.nombre, l.piso]))('Bloque %s · %s', (edificio, nombre, piso) => {
    const d = destinoDeLugar(edificio, nombre);
    expect(d, `${nombre} no tiene destino en el recorrido`).not.toBeNull();
    expect(d.nivel, `${nombre} está en otro piso del 3D`).toBe(piso);
  });

  test('un lugar inexistente o un bloque sin interior devuelven null', () => {
    expect(destinoDeLugar('B', 'Piscina olímpica')).toBeNull();
    expect(destinoDeLugar('Z', 'Biblioteca')).toBeNull();
  });

  test('ignora tildes y mayúsculas', () => {
    expect(destinoDeLugar('A', 'BIBLIOTECA')).toEqual(destinoDeLugar('A', 'Biblioteca'));
    expect(destinoDeLugar('B', 'tesoreria')).not.toBeNull();
  });
});

describe('Lugares mencionados en las respuestas de Coopi', () => {
  test('encuentra el primer lugar que se nombra', () => {
    const r = destinoEnTexto('A', 'La biblioteca queda en el piso 2; la cafetería en el piso 1.');
    expect(r.nombre.toLowerCase()).toContain('biblioteca');
    expect(r.nivel).toBe(2);
  });
  test('devuelve null si no se menciona ningún lugar', () => {
    expect(destinoEnTexto('A', 'Hola, ¿en qué te ayudo?')).toBeNull();
    expect(destinoEnTexto('Q', 'biblioteca')).toBeNull();
  });
});

test('nombres de los niveles', () => {
  expect(nombreNivel(-1)).toMatch(/Piso 0|Sótano/);
  expect(nombreNivel(3)).toBe('Piso 3');
});
