import { test, expect } from '@playwright/test';
import { fakeApi, enterAsGuest, data } from './fakeApi.js';

/**
 * Simulated microphone: the test browser has none, so SpeechRecognition is replaced by a fake one
 * and the test "says" a sentence through it.
 */
async function fakeMicrophone(page) {
  await page.addInitScript(() => {
    class FakeRecognition {
      start() { window.__recognitions = (window.__recognitions ?? []).concat(this); }
      stop() { this.onend?.(); }
      abort() {}
    }
    window.SpeechRecognition = FakeRecognition;
    window.webkitSpeechRecognition = FakeRecognition;
    window.__say = (text) => {
      const rec = window.__recognitions.at(-1);
      const result = Object.assign([{ transcript: text }], { isFinal: true });
      rec.onresult({ results: [result] });
    };
  });
}

test('saying "llévame a la facultad de ingeniería" walks you inside with no clicks', async ({ page }) => {
  const faculty = data.places.find(l => l.name === 'Facultad de Ingeniería');
  await fakeMicrophone(page);
  await fakeApi(page, { handsFree: true, answers: {
    'llévame a la facultad de ingeniería': {
      answer: '¡Vamos para allá! Facultad de Ingeniería queda en el piso 4 del Bloque B.', provider: 'coopi', buildingId: faculty.buildingId,
      action: { type: 'GO_TO_PLACE', placeId: faculty.id, buildingId: faculty.buildingId, floor: 4, label: faculty.name },
    },
  } });
  await enterAsGuest(page);

  // Coopi is already listening: the button says "escuchando" and the header invites to speak
  await expect(page.locator('#btn-wake')).toContainText('escuchando');
  await expect(page.locator('#chat-header')).toContainText('Te escucho');

  await page.evaluate(() => window.__say('llévame a la facultad de ingeniería'));
  await expect(page.locator('#walkthrough')).toBeVisible();
  await expect(page.locator('#rec-level')).toContainText('Piso 4');
  await expect(page.locator('#rec-place')).toContainText('Facultad de Ingeniería');
});

test('ordinary conversation near the microphone is ignored', async ({ page }) => {
  await fakeMicrophone(page);
  const requests = await fakeApi(page, { handsFree: true });
  await enterAsGuest(page);
  await expect(page.locator('#btn-wake')).toContainText('escuchando');
  await page.evaluate(() => window.__say('mañana tenemos clase de física'));
  await page.waitForTimeout(1000);
  expect(requests.some(r => r.path === '/api/assistant/ask')).toBe(false);
});

test('the «Ey Coopi» button turns hands-free off and it stays off', async ({ page }) => {
  await fakeMicrophone(page);
  await fakeApi(page, { handsFree: true });
  await enterAsGuest(page);
  await page.click('#btn-wake');
  await expect(page.locator('#btn-wake')).toContainText('apagado');
  expect(await page.evaluate(() => localStorage.getItem('ucc3d.handsFree'))).toBe('off');
});
