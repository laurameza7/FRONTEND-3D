import { describe, test, expect, vi, beforeEach } from 'vitest';
import { api, ApiError } from '../src/api.js';

function answer(status, body) {
  return { ok: status < 400, status: status, json: async () => { if (body === undefined) throw new Error('no body'); return body; } };
}

describe('API client', () => {
  let fakeFetch;
  beforeEach(() => {
    fakeFetch = vi.fn();
    globalThis.fetch = fakeFetch;
    api.useToken(null);
    api.onSessionExpired(null);
  });

  test('public routes do not send a token', async () => {
    fakeFetch.mockResolvedValue(answer(200, []));
    await api.programs();
    const [url, op] = fakeFetch.mock.calls[0];
    expect(url).toMatch(/\/api\/programs$/);
    expect(op.headers.Authorization).toBeUndefined();
  });

  test('with a session it sends "Authorization: Bearer <token>" and a JSON body', async () => {
    fakeFetch.mockResolvedValue(answer(200, { answer: 'hola' }));
    api.useToken('abc.def');
    await api.ask('¿dónde queda la biblioteca?', 7);
    const [url, op] = fakeFetch.mock.calls[0];
    expect(url).toMatch(/\/api\/assistant\/ask$/);
    expect(op.method).toBe('POST');
    expect(op.headers.Authorization).toBe('Bearer abc.def');
    expect(JSON.parse(op.body)).toEqual({ question: '¿dónde queda la biblioteca?', programId: 7 });
  });

  test('register sends the fingerprint and never a password field', async () => {
    fakeFetch.mockResolvedValue(answer(201, { token: 't' }));
    await api.register('Laura', 'laura@ucc.edu.co', 'a'.repeat(64));
    const body = JSON.parse(fakeFetch.mock.calls[0][1].body);
    expect(Object.keys(body).sort()).toEqual(['email', 'fingerprint', 'name']);
  });

  test('an error shows the backend message', async () => {
    fakeFetch.mockResolvedValue(answer(401, { error: 'Correo o contraseña incorrectos.' }));
    const e = await api.login('x@y.co', 'h').catch(e => e);
    expect(e).toBeInstanceOf(ApiError);
    expect(e.status).toBe(401);
    expect(e.message).toBe('Correo o contraseña incorrectos.');
  });

  test('an error without body uses "Error <status>"', async () => {
    fakeFetch.mockResolvedValue(answer(503));
    await expect(api.health()).rejects.toThrow('Error 503');
  });

  test('a 401 with a session outside /api/auth reports that the session expired', async () => {
    const onExpire = vi.fn();
    api.onSessionExpired(onExpire);
    api.useToken('expired');
    fakeFetch.mockResolvedValue(answer(401, { error: 'Debes iniciar sesión o entrar como invitado.' }));
    await expect(api.greeting()).rejects.toBeInstanceOf(ApiError);
    expect(onExpire).toHaveBeenCalledTimes(1);

    await expect(api.login('a@b.co', 'h')).rejects.toBeInstanceOf(ApiError);
    expect(onExpire).toHaveBeenCalledTimes(1);           // not on /api/auth
  });
});
