import { test, expect } from '@playwright/test';
import { fakeApi, enterAsGuest } from './fakeApi.js';

test('on a phone the page does not overflow and you can talk to Coopi', async ({ page }) => {
  await fakeApi(page);
  await enterAsGuest(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  if (!(await page.locator('#question').isVisible())) await page.locator('#chat-header').click();
  await page.fill('#question', 'hola');
  await page.press('#question', 'Enter');
  await expect(page.locator('#messages .msg.bot').last()).toBeVisible();
});
