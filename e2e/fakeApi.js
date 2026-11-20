import fs from 'node:fs';

const read = (n) => JSON.parse(fs.readFileSync(new URL(`./data/${n}.json`, import.meta.url), 'utf8'));
export const data = { buildings: read('buildings'), places: read('places'), programs: read('programs') };

/**
 * Simulates the Java backend. `answers` decides what Coopi replies to each question.
 * Returns the log of requests so the test can check them.
 */
export async function fakeApi(page, { answers = {} } = {}) {
  const requests = [];
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    requests.push({ path, method: req.method(), body, auth: req.headers().authorization });
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/api/buildings') return json(200, data.buildings);
    if (path === '/api/places') return json(200, data.places);
    if (path === '/api/programs') return json(200, data.programs);
    if (path === '/api/health') return json(200, { status: 'ok' });
    if (path === '/api/auth/guest') return json(200, { token: 'tok.guest', name: 'Invitado', role: 'GUEST' });
    if (path === '/api/auth/register')
      return json(201, { token: 'tok.user', id: 1, name: body.name, email: body.email, role: 'STUDENT' });
    if (path === '/api/auth/login') return json(401, { error: 'Correo o contraseña incorrectos.' });
    if (!req.headers().authorization) return json(401, { error: 'Debes iniciar sesión o entrar como invitado.' });
    if (path === '/api/assistant/greeting') return json(200, { answer: '¡Hola! ¿Cómo estás? ¿En qué te puedo ayudar hoy?' });
    if (path === '/api/assistant/history') return json(200, []);
    if (path === '/api/assistant/ask') {
      const r = answers[body.question] ?? { answer: 'No encontré esa información.', provider: 'local' };
      return json(200, r);
    }
    return json(404, { error: 'La ruta solicitada no existe.' });
  });
  return requests;
}

/** Enters as a guest and waits for Coopi's greeting. */
export async function enterAsGuest(page) {
  await page.goto('/');
  await page.locator('#access').waitFor({ state: 'visible', timeout: 90_000 });
  await page.click('#acc-guest');
  await page.locator('#messages .msg.bot').first().waitFor();
}
