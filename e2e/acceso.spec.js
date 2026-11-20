import { test, expect } from '@playwright/test';
import { apiFalsa, entrarComoInvitado } from './apiFalsa.js';

test.describe('Acceso al sistema', () => {
  test('la pantalla de carga da paso al ingreso y la contraseña está oculta y limitada a 30', async ({ page }) => {
    await apiFalsa(page);
    await page.goto('/');
    await expect(page.locator('#acceso')).toBeVisible({ timeout: 90_000 });
    await expect(page.locator('#carga')).toBeHidden();
    const clave = page.locator('#acc-clave');
    await expect(clave).toHaveAttribute('type', 'password');
    await expect(clave).toHaveAttribute('maxlength', '30');
    await clave.fill('x'.repeat(40));
    await expect(clave).toHaveValue('x'.repeat(30));
    await expect(page.locator('#acc-contador')).toHaveText('30/30');
  });

  test('al registrarse solo viaja la huella SHA-256, nunca la contraseña', async ({ page }) => {
    const peticiones = await apiFalsa(page);
    await page.goto('/');
    await page.locator('#acceso').waitFor({ state: 'visible', timeout: 90_000 });
    await page.click('.acc-pestanas button[data-modo="registro"]');
    await page.fill('#acc-nombre', 'Laura Meza');
    await page.fill('#acc-correo', 'laura@campusucc.edu.co');
    await page.fill('#acc-clave', 'MiClave#2026');
    await page.fill('#acc-confirmar', 'MiClave#2026');
    await page.click('#acc-enviar');
    await expect(page.locator('#acceso')).toBeHidden();

    const registro = peticiones.find(p => p.ruta === '/api/auth/registro');
    expect(registro.cuerpo.huella).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(registro.cuerpo)).not.toContain('MiClave#2026');
    // Tampoco queda guardada en el navegador ni en la página
    const guardado = await page.evaluate(() => JSON.stringify(localStorage));
    expect(guardado).not.toContain('MiClave#2026');
    expect(guardado).not.toContain(registro.cuerpo.huella);
    await expect(page.locator('#acc-clave')).toHaveValue('');
    // Coopi saluda por el nombre
    await expect(page.locator('#usuario-nombre')).toContainText('Laura');
  });

  test('valida contraseñas cortas y que coincidan antes de enviar', async ({ page }) => {
    const peticiones = await apiFalsa(page);
    await page.goto('/');
    await page.locator('#acceso').waitFor({ state: 'visible', timeout: 90_000 });
    await page.click('.acc-pestanas button[data-modo="registro"]');
    await page.fill('#acc-nombre', 'Juan');
    await page.fill('#acc-correo', 'juan@campusucc.edu.co');
    await page.fill('#acc-clave', 'clave-larga-1');
    await page.fill('#acc-confirmar', 'clave-larga-2');
    await page.click('#acc-enviar');
    await expect(page.locator('#acc-error')).toHaveText('Las contraseñas no coinciden.');
    expect(peticiones.some(p => p.ruta === '/api/auth/registro')).toBe(false);
  });

  test('muestra el mensaje del backend si la contraseña es incorrecta', async ({ page }) => {
    await apiFalsa(page);
    await page.goto('/');
    await page.locator('#acceso').waitFor({ state: 'visible', timeout: 90_000 });
    await page.fill('#acc-correo', 'manuel@campusucc.edu.co');
    await page.fill('#acc-clave', 'equivocada');
    await page.click('#acc-enviar');
    await expect(page.locator('#acc-error')).toHaveText('Correo o contraseña incorrectos.');
  });

  test('como invitado Coopi saluda y se puede salir', async ({ page }) => {
    await apiFalsa(page);
    await entrarComoInvitado(page);
    await expect(page.locator('#mensajes .msg.bot').first()).toContainText('¿En qué te puedo ayudar hoy?');
    await page.click('#btn-salir');
    await expect(page.locator('#acceso')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('ucc3d.sesion'))).toBeNull();
  });
});
