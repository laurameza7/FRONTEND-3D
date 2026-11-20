import { describe, test, expect, beforeEach } from 'vitest';
import { huella, sesionGuardada, cerrarSesion, MAX_CLAVE, MIN_CLAVE } from '../src/sesion.js';

describe('Contraseña', () => {
  test('la huella es SHA-256 en hexadecimal (vector oficial de "abc")', async () => {
    expect(await huella('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  test('siempre tiene 64 caracteres y no contiene la contraseña', async () => {
    for (const clave of ['123456', 'MiClave#2026', 'ñandú con tildes', 'x'.repeat(MAX_CLAVE)]) {
      const h = await huella(clave);
      expect(h).toMatch(/^[a-f0-9]{64}$/);
      expect(h).not.toContain(clave);
    }
  });

  test('dos contraseñas distintas dan huellas distintas', async () => {
    expect(await huella('clave1')).not.toBe(await huella('clave2'));
  });

  test('límites de longitud: entre 6 y 30 caracteres', () => {
    expect(MIN_CLAVE).toBe(6);
    expect(MAX_CLAVE).toBe(30);
  });
});

describe('Sesión guardada en el navegador', () => {
  beforeEach(() => localStorage.clear());

  test('sin sesión devuelve null', () => {
    expect(sesionGuardada()).toBeNull();
  });

  test('si el valor guardado está dañado devuelve null en vez de fallar', () => {
    localStorage.setItem('ucc3d.sesion', '{no es json');
    expect(sesionGuardada()).toBeNull();
  });

  test('cerrar sesión borra lo guardado', () => {
    localStorage.setItem('ucc3d.sesion', JSON.stringify({ token: 't', nombre: 'Laura' }));
    expect(sesionGuardada().nombre).toBe('Laura');
    cerrarSesion();
    expect(sesionGuardada()).toBeNull();
  });
});
