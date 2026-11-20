import { test, expect } from '@playwright/test';
import { apiFalsa, entrarComoInvitado } from './apiFalsa.js';

test('en el celular la página no se desborda y se puede hablar con Coopi', async ({ page }) => {
  await apiFalsa(page);
  await entrarComoInvitado(page);
  const desborde = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(desborde).toBeLessThanOrEqual(1);
  if (!(await page.locator('#pregunta').isVisible())) await page.locator('#chat-cabecera').click();
  await page.fill('#pregunta', 'hola');
  await page.press('#pregunta', 'Enter');
  await expect(page.locator('#mensajes .msg.bot').last()).toBeVisible();
});
