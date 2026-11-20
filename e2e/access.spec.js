import { test, expect } from '@playwright/test';
import { fakeApi, enterAsGuest } from './fakeApi.js';

test.describe('Access to the system', () => {
  test('the loading screen leads to login and the password is hidden and limited to 30', async ({ page }) => {
    await fakeApi(page);
    await page.goto('/');
    await expect(page.locator('#access')).toBeVisible({ timeout: 90_000 });
    await expect(page.locator('#loading')).toBeHidden();
    const password = page.locator('#acc-password');
    await expect(password).toHaveAttribute('type', 'password');
    await expect(password).toHaveAttribute('maxlength', '30');
    await password.fill('x'.repeat(40));
    await expect(password).toHaveValue('x'.repeat(30));
    await expect(page.locator('#acc-counter')).toHaveText('30/30');
  });

  test('registering only sends the SHA-256 fingerprint, never the password', async ({ page }) => {
    const requests = await fakeApi(page);
    await page.goto('/');
    await page.locator('#access').waitFor({ state: 'visible', timeout: 90_000 });
    await page.click('.acc-tabs button[data-mode="register"]');
    await page.fill('#acc-name', 'Laura Meza');
    await page.fill('#acc-email', 'laura@campusucc.edu.co');
    await page.fill('#acc-password', 'MiClave#2026');
    await page.fill('#acc-confirm', 'MiClave#2026');
    await page.click('#acc-submit');
    await expect(page.locator('#access')).toBeHidden();

    const register = requests.find(p => p.path === '/api/auth/register');
    expect(register.body.fingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(register.body)).not.toContain('MiClave#2026');
    // It is not stored in the browser nor in the page either
    const stored = await page.evaluate(() => JSON.stringify(localStorage));
    expect(stored).not.toContain('MiClave#2026');
    expect(stored).not.toContain(register.body.fingerprint);
    await expect(page.locator('#acc-password')).toHaveValue('');
    // Coopi greets by name
    await expect(page.locator('#user-name')).toContainText('Laura');
  });

  test('validates that both passwords match before sending', async ({ page }) => {
    const requests = await fakeApi(page);
    await page.goto('/');
    await page.locator('#access').waitFor({ state: 'visible', timeout: 90_000 });
    await page.click('.acc-tabs button[data-mode="register"]');
    await page.fill('#acc-name', 'Juan');
    await page.fill('#acc-email', 'juan@campusucc.edu.co');
    await page.fill('#acc-password', 'clave-larga-1');
    await page.fill('#acc-confirm', 'clave-larga-2');
    await page.click('#acc-submit');
    await expect(page.locator('#acc-error')).toHaveText('Las contraseñas no coinciden.');
    expect(requests.some(p => p.path === '/api/auth/register')).toBe(false);
  });

  test('shows the backend message when the password is wrong', async ({ page }) => {
    await fakeApi(page);
    await page.goto('/');
    await page.locator('#access').waitFor({ state: 'visible', timeout: 90_000 });
    await page.fill('#acc-email', 'manuel@campusucc.edu.co');
    await page.fill('#acc-password', 'equivocada');
    await page.click('#acc-submit');
    await expect(page.locator('#acc-error')).toHaveText('Correo o contraseña incorrectos.');
  });

  test('as a guest Coopi greets and you can log out', async ({ page }) => {
    await fakeApi(page);
    await enterAsGuest(page);
    await expect(page.locator('#messages .msg.bot').first()).toContainText('¿En qué te puedo ayudar hoy?');
    await page.click('#btn-logout');
    await expect(page.locator('#access')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('ucc3d.session'))).toBeNull();
  });
});
