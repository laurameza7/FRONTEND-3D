import { describe, test, expect } from 'vitest';
import { WAKE_WORD, GO_COMMAND, Voice } from '../src/voice.js';

const remove = (t) => t.replace(WAKE_WORD, '').trim();

describe('Wake word "Ey Coopi"', () => {
  test.each([
    ['Ey Coopi, llévame a la biblioteca', 'llévame a la biblioteca'],
    ['oye copi dónde queda tesorería', 'dónde queda tesorería'],
    ['hey Kopi qué programas hay', 'qué programas hay'],
    ['Coopi: hola', 'hola'],
    ['ok cupi muéstrame el gimnasio', 'muéstrame el gimnasio'],
  ])('«%s» → «%s»', (spoken, question) => {
    expect(WAKE_WORD.test(spoken)).toBe(true);
    expect(remove(spoken)).toBe(question);
  });

  test.each(['llévame a la cafetería', 'copia de mi recibo', 'hola cómo estás', 'cooperativa comuna'])(
    'does not activate with «%s»', (spoken) => {
      expect(WAKE_WORD.test(spoken)).toBe(false);
    });
});

test('it does not break without browser speech support', () => {
  const v = new Voice({});
  expect(v.canListen).toBe(false);
  expect(typeof v.canSpeak).toBe('boolean');
});

describe('Navigation orders understood without "Ey Coopi"', () => {
  test.each(['llévame a la facultad de ingeniería', 'Llevame a la biblioteca', '¿Dónde queda tesorería?', 'quiero ir al gimnasio',
    'muéstrame la cafetería', 'por favor llévame al bloque A', 'cómo llego a la clínica'])('«%s» is an order', (spoken) => {
    expect(GO_COMMAND.test(spoken)).toBe(true);
  });
  test.each(['hola a todos', 'mañana vamos a clase de física con el profe', 'el profesor dijo que fuéramos', 'llevamos tres horas aquí'])(
    '«%s» is ordinary conversation', (spoken) => {
      expect(GO_COMMAND.test(spoken)).toBe(false);
    });
});
