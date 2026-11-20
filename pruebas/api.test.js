import { describe, test, expect, vi, beforeEach } from 'vitest';
import { api, ErrorApi } from '../src/api.js';

function respuesta(estado, cuerpo) {
  return { ok: estado < 400, status: estado, json: async () => { if (cuerpo === undefined) throw new Error('sin cuerpo'); return cuerpo; } };
}

describe('Cliente de la API', () => {
  let fetchFalso;
  beforeEach(() => {
    fetchFalso = vi.fn();
    globalThis.fetch = fetchFalso;
    api.usarToken(null);
    api.alExpirarSesion(null);
  });

  test('las rutas públicas no envían token', async () => {
    fetchFalso.mockResolvedValue(respuesta(200, []));
    await api.programas();
    const [url, op] = fetchFalso.mock.calls[0];
    expect(url).toMatch(/\/api\/programas$/);
    expect(op.headers.Authorization).toBeUndefined();
  });

  test('con sesión envía "Authorization: Bearer <token>" y el cuerpo en JSON', async () => {
    fetchFalso.mockResolvedValue(respuesta(200, { respuesta: 'hola' }));
    api.usarToken('abc.def');
    await api.preguntar('¿dónde queda la biblioteca?', 7);
    const [url, op] = fetchFalso.mock.calls[0];
    expect(url).toMatch(/\/api\/asistente\/preguntar$/);
    expect(op.method).toBe('POST');
    expect(op.headers.Authorization).toBe('Bearer abc.def');
    expect(JSON.parse(op.body)).toEqual({ pregunta: '¿dónde queda la biblioteca?', programaId: 7 });
  });

  test('el registro envía la huella y nunca un campo de contraseña', async () => {
    fetchFalso.mockResolvedValue(respuesta(201, { token: 't' }));
    await api.registrar('Laura', 'laura@ucc.edu.co', 'a'.repeat(64));
    const cuerpo = JSON.parse(fetchFalso.mock.calls[0][1].body);
    expect(Object.keys(cuerpo).sort()).toEqual(['correo', 'huella', 'nombre']);
  });

  test('un error muestra el mensaje del backend', async () => {
    fetchFalso.mockResolvedValue(respuesta(401, { error: 'Correo o contraseña incorrectos.' }));
    const e = await api.ingresar('x@y.co', 'h').catch(e => e);
    expect(e).toBeInstanceOf(ErrorApi);
    expect(e.estado).toBe(401);
    expect(e.message).toBe('Correo o contraseña incorrectos.');
  });

  test('si el error no trae cuerpo usa "Error <código>"', async () => {
    fetchFalso.mockResolvedValue(respuesta(503));
    await expect(api.salud()).rejects.toThrow('Error 503');
  });

  test('un 401 con sesión fuera de /api/auth avisa que la sesión venció', async () => {
    const alExpirar = vi.fn();
    api.alExpirarSesion(alExpirar);
    api.usarToken('vencido');
    fetchFalso.mockResolvedValue(respuesta(401, { error: 'Debes iniciar sesión o entrar como invitado.' }));
    await expect(api.saludo()).rejects.toBeInstanceOf(ErrorApi);
    expect(alExpirar).toHaveBeenCalledTimes(1);

    await expect(api.ingresar('a@b.co', 'h')).rejects.toBeInstanceOf(ErrorApi);
    expect(alExpirar).toHaveBeenCalledTimes(1);           // en /api/auth no
  });
});
