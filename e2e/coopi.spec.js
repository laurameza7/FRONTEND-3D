import { test, expect } from '@playwright/test';
import { fakeApi, enterAsGuest, data } from './fakeApi.js';

const place = (n) => data.places.find(l => l.name === n);
const program = (n) => data.programs.find(p => p.name === n);

test.describe('Coopi and navigation', () => {
  test('"llévame a la biblioteca" opens the Block A walkthrough on floor 2', async ({ page }) => {
    const b = place('Biblioteca');
    const requests = await fakeApi(page, { answers: {
      'llévame a la biblioteca': { answer: '¡Vamos! Te llevo a Biblioteca, en el piso 2 del Bloque A.', provider: 'coopi',
        buildingId: b.buildingId, action: { type: 'GO_TO_PLACE', placeId: b.id, buildingId: b.buildingId, floor: 2, label: 'Biblioteca' } },
    } });
    await enterAsGuest(page);
    await page.fill('#question', 'llévame a la biblioteca');
    await page.press('#question', 'Enter');
    await expect(page.locator('#walkthrough')).toBeVisible();
    await expect(page.locator('#rec-building')).toContainText('Bloque A');
    await expect(page.locator('#rec-level')).toContainText('Piso 2');
    const question = requests.find(p => p.path === '/api/assistant/ask');
    expect(question.auth).toBe('Bearer tok.guest');
  });

  test('"llévame al gimnasio" enters Floor 1 of Block B', async ({ page }) => {
    const g = place('Gimnasio');
    await fakeApi(page, { answers: {
      'llévame al gimnasio': { answer: '¡Vamos! Te llevo a Gimnasio.', provider: 'coopi', buildingId: g.buildingId,
        action: { type: 'GO_TO_PLACE', placeId: g.id, buildingId: g.buildingId, floor: 1, label: 'Gimnasio' } },
    } });
    await enterAsGuest(page);
    await page.fill('#question', 'llévame al gimnasio');
    await page.press('#question', 'Enter');
    await expect(page.locator('#rec-building')).toContainText('Bloque B');
    await expect(page.locator('#rec-place')).toContainText('Gimnasio');
  });

  test('"¿qué programas hay?" opens the window with all programs', async ({ page }) => {
    await fakeApi(page, { answers: {
      '¿qué programas hay?': { answer: 'Te abrí la lista completa.', provider: 'coopi', action: { type: 'SHOW_PROGRAMS' } },
    } });
    await enterAsGuest(page);
    await page.fill('#question', '¿qué programas hay?');
    await page.press('#question', 'Enter');
    await expect(page.locator('#programs')).toBeVisible();
    await expect(page.locator('#programs-list .program-card')).toHaveCount(data.programs.length);
  });

  test('searching and tapping a program takes you to its faculty', async ({ page }) => {
    await fakeApi(page);
    await enterAsGuest(page);
    await page.click('#btn-programs');
    await page.fill('#programs-search', 'software');
    await expect(page.locator('#programs-list .program-card')).toHaveCount(1);
    await page.click(`#programs-list .program-card[data-id="${program('Ingeniería de Software').id}"]`);
    await expect(page.locator('#walkthrough')).toBeVisible();
    await expect(page.locator('#rec-level')).toContainText('Piso 4');
    await expect(page.locator('#rec-place')).toContainText('Facultad de Ingeniería');
  });

  test('when Coopi does not know, it answers without actions and nothing breaks', async ({ page }) => {
    await fakeApi(page);
    await enterAsGuest(page);
    await page.fill('#question', '¿quién ganó el partido?');
    await page.press('#question', 'Enter');
    await expect(page.locator('#messages .msg.bot').last()).toHaveText(/No encontré esa información/);
    await expect(page.locator('#walkthrough')).toBeHidden();
  });
});
