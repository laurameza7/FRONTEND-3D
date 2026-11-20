import { describe, test, expect } from 'vitest';
import { ACTIVACION, Voz } from '../src/voz.js';

const quitar = (t) => t.replace(ACTIVACION, '').trim();

describe('Palabra de activación "Ey Coopi"', () => {
  test.each([
    ['Ey Coopi, llévame a la biblioteca', 'llévame a la biblioteca'],
    ['oye copi dónde queda tesorería', 'dónde queda tesorería'],
    ['hey Kopi qué programas hay', 'qué programas hay'],
    ['Coopi: hola', 'hola'],
    ['ok cupi muéstrame el gimnasio', 'muéstrame el gimnasio'],
  ])('«%s» → «%s»', (dicho, pregunta) => {
    expect(ACTIVACION.test(dicho)).toBe(true);
    expect(quitar(dicho)).toBe(pregunta);
  });

  test.each(['llévame a la cafetería', 'copia de mi recibo', 'hola cómo estás', 'cooperativa comuna'])(
    'no se activa con «%s»', (dicho) => {
      expect(ACTIVACION.test(dicho)).toBe(false);
    });
});

test('sin soporte de voz en el navegador no se rompe', () => {
  const v = new Voz({});
  expect(v.puedeEscuchar).toBe(false);
  expect(typeof v.puedeHablar).toBe('boolean');
});
