import { test, expect } from '@playwright/test';
import { apiFalsa, entrarComoInvitado, datos } from './apiFalsa.js';

const lugar = (n) => datos.lugares.find(l => l.nombre === n);
const programa = (n) => datos.programas.find(p => p.nombre === n);

test.describe('Coopi y la navegación', () => {
  test('"llévame a la biblioteca" abre el recorrido del Bloque A en el piso 2', async ({ page }) => {
    const b = lugar('Biblioteca');
    const peticiones = await apiFalsa(page, { respuestas: {
      'llévame a la biblioteca': { respuesta: '¡Vamos! Te llevo a Biblioteca, en el piso 2 del Bloque A.', proveedor: 'coopi',
        edificioId: b.edificioId, accion: { tipo: 'IR_LUGAR', lugarId: b.id, edificioId: b.edificioId, piso: 2, etiqueta: 'Biblioteca' } },
    } });
    await entrarComoInvitado(page);
    await page.fill('#pregunta', 'llévame a la biblioteca');
    await page.press('#pregunta', 'Enter');
    await expect(page.locator('#recorrido')).toBeVisible();
    await expect(page.locator('#rec-edificio')).toContainText('Bloque A');
    await expect(page.locator('#rec-nivel')).toContainText('Piso 2');
    const pregunta = peticiones.find(p => p.ruta === '/api/asistente/preguntar');
    expect(pregunta.auth).toBe('Bearer tok.invitado');
  });

  test('"llévame al gimnasio" entra al Piso 1 del Bloque B', async ({ page }) => {
    const g = lugar('Gimnasio');
    await apiFalsa(page, { respuestas: {
      'llévame al gimnasio': { respuesta: '¡Vamos! Te llevo a Gimnasio.', proveedor: 'coopi', edificioId: g.edificioId,
        accion: { tipo: 'IR_LUGAR', lugarId: g.id, edificioId: g.edificioId, piso: 1, etiqueta: 'Gimnasio' } },
    } });
    await entrarComoInvitado(page);
    await page.fill('#pregunta', 'llévame al gimnasio');
    await page.press('#pregunta', 'Enter');
    await expect(page.locator('#rec-edificio')).toContainText('Bloque B');
    await expect(page.locator('#rec-lugar')).toContainText('Gimnasio');
  });

  test('"¿qué programas hay?" abre la ventana con todos los programas', async ({ page }) => {
    await apiFalsa(page, { respuestas: {
      '¿qué programas hay?': { respuesta: 'Te abrí la lista completa.', proveedor: 'coopi', accion: { tipo: 'VER_PROGRAMAS' } },
    } });
    await entrarComoInvitado(page);
    await page.fill('#pregunta', '¿qué programas hay?');
    await page.press('#pregunta', 'Enter');
    await expect(page.locator('#programas')).toBeVisible();
    await expect(page.locator('#programas-lista .tarjeta-programa')).toHaveCount(datos.programas.length);
  });

  test('buscar y tocar un programa lleva a su facultad', async ({ page }) => {
    await apiFalsa(page);
    await entrarComoInvitado(page);
    await page.click('#btn-programas');
    await page.fill('#programas-buscar', 'software');
    await expect(page.locator('#programas-lista .tarjeta-programa')).toHaveCount(1);
    await page.click(`#programas-lista .tarjeta-programa[data-id="${programa('Ingeniería de Software').id}"]`);
    await expect(page.locator('#recorrido')).toBeVisible();
    await expect(page.locator('#rec-nivel')).toContainText('Piso 4');
    await expect(page.locator('#rec-lugar')).toContainText('Facultad de Ingeniería');
  });

  test('si Coopi no sabe, responde sin acciones y no se rompe nada', async ({ page }) => {
    await apiFalsa(page);
    await entrarComoInvitado(page);
    await page.fill('#pregunta', '¿quién ganó el partido?');
    await page.press('#pregunta', 'Enter');
    await expect(page.locator('#mensajes .msg.bot').last()).toHaveText(/No encontré esa información/);
    await expect(page.locator('#recorrido')).toBeHidden();
  });
});
