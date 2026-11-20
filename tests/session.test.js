import { describe, test, expect, beforeEach } from 'vitest';
import { fingerprint, savedSession, logout, MAX_PASSWORD, MIN_PASSWORD } from '../src/session.js';

describe('Password', () => {
  test('the fingerprint is SHA-256 in hex (official "abc" vector)', async () => {
    expect(await fingerprint('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  test('it always has 64 characters and does not contain the password', async () => {
    for (const password of ['123456', 'MiClave#2026', 'ñandú con tildes', 'x'.repeat(MAX_PASSWORD)]) {
      const h = await fingerprint(password);
      expect(h).toMatch(/^[a-f0-9]{64}$/);
      expect(h).not.toContain(password);
    }
  });

  test('two different passwords give different fingerprints', async () => {
    expect(await fingerprint('clave1')).not.toBe(await fingerprint('clave2'));
  });

  test('length limits: between 6 and 30 characters', () => {
    expect(MIN_PASSWORD).toBe(6);
    expect(MAX_PASSWORD).toBe(30);
  });
});

describe('Session saved in the browser', () => {
  beforeEach(() => localStorage.clear());

  test('without a session it returns null', () => {
    expect(savedSession()).toBeNull();
  });

  test('a corrupted saved value returns null instead of failing', () => {
    localStorage.setItem('ucc3d.session', '{not json');
    expect(savedSession()).toBeNull();
  });

  test('logout clears the saved session', () => {
    localStorage.setItem('ucc3d.session', JSON.stringify({ token: 't', name: 'Laura' }));
    expect(savedSession().name).toBe('Laura');
    logout();
    expect(savedSession()).toBeNull();
  });
});
