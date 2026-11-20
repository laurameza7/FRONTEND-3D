import { describe, test, expect } from 'vitest';
import { INTERIORS } from '../src/floorPlans.js';
import { destinationOfPlace, destinationInText, hasInterior } from '../src/walkthrough.js';
import { levelName } from '../src/blocks.js';
import places from './db-places.json';

describe('Interiors of blocks A and B', () => {
  test('both blocks exist with their starting floor', () => {
    expect(hasInterior('A')).toBe(true);
    expect(hasInterior('B')).toBe(true);
    expect(hasInterior('X')).toBe(false);
    for (const bld of Object.values(INTERIORS))
      expect(bld.levels.some(n => n.id === bld.start)).toBe(true);
  });

  test('Block A has 7 levels and Block B 9 (with basements)', () => {
    expect(INTERIORS.A.levels.map(n => n.id)).toEqual([6, 5, 4, 3, 2, 1, -1]);
    expect(INTERIORS.B.levels.map(n => n.id)).toEqual([7, 6, 5, 4, 3, 2, 1, -1, -2]);
  });

  test.each(Object.entries(INTERIORS).flatMap(([c, e]) => e.levels.map(n => [c, n])))(
    'Block %s level with unique, well-formed destinations', (_, n) => {
      const ids = n.destinations.map(d => d.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const d of n.destinations) {
        expect(typeof d.name).toBe('string');
        expect(Number.isFinite(d.x) && Number.isFinite(d.z)).toBe(true);
      }
      expect(n.destinations.filter(d => !d.hidden).length).toBeGreaterThan(0);
      expect(typeof n.build).toBe('function');
    });
});

describe('Every place in the database has a destination', () => {
  test.each(places.map(l => [l.building, l.name, l.floor]))('Block %s · %s', (building, name, floor) => {
    const d = destinationOfPlace(building, name);
    expect(d, `${name} has no destination in the walkthrough`).not.toBeNull();
    expect(d.level, `${name} is on another floor in 3D`).toBe(floor);
  });

  test('an unknown place or a block without interior return null', () => {
    expect(destinationOfPlace('B', 'Piscina olímpica')).toBeNull();
    expect(destinationOfPlace('Z', 'Biblioteca')).toBeNull();
  });

  test('ignores accents and capitals', () => {
    expect(destinationOfPlace('A', 'BIBLIOTECA')).toEqual(destinationOfPlace('A', 'Biblioteca'));
    expect(destinationOfPlace('B', 'tesoreria')).not.toBeNull();
  });
});

describe('Places mentioned in Coopi answers', () => {
  test('finds the first place that is named', () => {
    const r = destinationInText('A', 'La biblioteca queda en el piso 2; la cafetería en el piso 1.');
    expect(r.name.toLowerCase()).toContain('biblioteca');
    expect(r.level).toBe(2);
  });
  test('returns null when no place is mentioned', () => {
    expect(destinationInText('A', 'Hola, ¿en qué te ayudo?')).toBeNull();
    expect(destinationInText('Q', 'biblioteca')).toBeNull();
  });
});

test('level names', () => {
  expect(levelName(-1)).toMatch(/Piso 0|Sótano/);
  expect(levelName(3)).toBe('Piso 3');
});
