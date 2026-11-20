import fs from 'node:fs';

const leer = (n) => JSON.parse(fs.readFileSync(new URL(`./datos/${n}.json`, import.meta.url), 'utf8'));
export const datos = { edificios: leer('edificios'), lugares: leer('lugares'), programas: leer('programas') };

/**
 * Simula el backend de Java. `respuestas` permite decidir qué contesta Coopi a cada pregunta.
 * Devuelve el registro de las peticiones para revisarlas en la prueba.
 */
export async function apiFalsa(page, { respuestas = {} } = {}) {
  const peticiones = [];
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const ruta = new URL(req.url()).pathname;
    const cuerpo = req.postData() ? JSON.parse(req.postData()) : null;
    peticiones.push({ ruta, metodo: req.method(), cuerpo, auth: req.headers().authorization });
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (ruta === '/api/edificios') return json(200, datos.edificios);
    if (ruta === '/api/lugares') return json(200, datos.lugares);
    if (ruta === '/api/programas') return json(200, datos.programas);
    if (ruta === '/api/salud') return json(200, { estado: 'ok' });
    if (ruta === '/api/auth/invitado') return json(200, { token: 'tok.invitado', nombre: 'Invitado', rol: 'INVITADO' });
    if (ruta === '/api/auth/registro')
      return json(201, { token: 'tok.usuario', id: 1, nombre: cuerpo.nombre, correo: cuerpo.correo, rol: 'ESTUDIANTE' });
    if (ruta === '/api/auth/ingresar') return json(401, { error: 'Correo o contraseña incorrectos.' });
    if (!req.headers().authorization) return json(401, { error: 'Debes iniciar sesión o entrar como invitado.' });
    if (ruta === '/api/asistente/saludo') return json(200, { respuesta: '¡Hola! ¿Cómo estás? ¿En qué te puedo ayudar hoy?' });
    if (ruta === '/api/asistente/historial') return json(200, []);
    if (ruta === '/api/asistente/preguntar') {
      const r = respuestas[cuerpo.pregunta] ?? { respuesta: 'No encontré esa información.', proveedor: 'local' };
      return json(200, r);
    }
    return json(404, { error: 'La ruta solicitada no existe.' });
  });
  return peticiones;
}

/** Entra como invitado y espera el saludo de Coopi. */
export async function entrarComoInvitado(page) {
  await page.goto('/');
  await page.locator('#acceso').waitFor({ state: 'visible', timeout: 45_000 });
  await page.click('#acc-invitado');
  await page.locator('#mensajes .msg.bot').first().waitFor();
}
