import { test, expect } from '@playwright/test';
import { apiFalsa, entrarComoInvitado } from './apiFalsa.js';

/**
 * Arma cada piso de los bloques A y B con el Kit real (muros, muebles, escaleras) y revisa:
 *  - que ningún destino del menú "Ir a…" quede dentro de un mueble o muro,
 *  - que desde el primer destino se pueda caminar a todos los demás,
 *  - que cada escalera o paso entre bloques lleve a un destino que existe.
 */
test('todos los pisos se pueden recorrer y cada destino es alcanzable', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('/');
  const informe = await page.evaluate(async () => {
    const { Kit } = await import('/src/recorrido.js');
    const { INTERIORES } = await import('/src/planos.js');
    const problemas = [];
    let pisos = 0, destinos = 0;
    for (const [cod, ed] of Object.entries(INTERIORES)) {
      for (const n of ed.niveles) {
        const k = new Kit({ add() {} }, n.estilo ?? {});
        k.destinos = [...(n.destinos ?? [])];
        n.construir(k);
        pisos++; destinos += k.destinos.length;
        const L = k.limites, h = 0.2;
        const W = Math.round((L.x1 - L.x0) / h), H = Math.round((L.z1 - L.z0) / h);
        const idx = (i, j) => j * (W + 1) + i;
        const celda = (x, z) => [Math.round((x - L.x0) / h), Math.round((z - L.z0) / h)];
        for (const d of k.destinos) if (!k.libre(d.x, d.z)) problemas.push(`${cod}${n.id}: destino bloqueado ${d.id}`);
        const inicio = k.destinos.find(d => k.libre(d.x, d.z));
        const vis = new Uint8Array((W + 1) * (H + 1));
        const cola = [celda(inicio.x, inicio.z)];
        vis[idx(...cola[0])] = 1;
        while (cola.length) {
          const [i, j] = cola.pop();
          for (const [a, c] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
            if (a < 0 || c < 0 || a > W || c > H || vis[idx(a, c)] || !k.libre(L.x0 + a * h, L.z0 + c * h)) continue;
            vis[idx(a, c)] = 1; cola.push([a, c]);
          }
        }
        for (const d of k.destinos) {
          const [i, j] = celda(d.x, d.z);
          let ok = false;
          for (let a = -2; a <= 2 && !ok; a++) for (let c = -2; c <= 2 && !ok; c++) ok = vis[idx(i + a, j + c)] === 1;
          if (!ok) problemas.push(`${cod}${n.id}: no se llega a ${d.id}`);
        }
        for (const p of k.portales) {
          const destinoEd = INTERIORES[p.edificio ?? cod];
          const nivel = destinoEd?.niveles.find(m => m.id === p.nivel);
          if (!nivel || !(nivel.destinos ?? []).some(d => d.id === p.llegada))
            problemas.push(`${cod}${n.id}: portal hacia ${p.edificio ?? cod}${p.nivel}/${p.llegada} sin llegada`);
        }
      }
    }
    return { pisos, destinos, problemas };
  });
  expect(informe.problemas).toEqual([]);
  expect(informe.pisos).toBe(16);
  expect(informe.destinos).toBeGreaterThan(140);
});

test('subir por la escalera cambia de piso', async ({ page }) => {
  await apiFalsa(page);
  await entrarComoInvitado(page);
  await page.evaluate(() => window.ucc3d.recorrido.abrir('B', 1, 'escaleras'));
  await expect(page.locator('#rec-nivel')).toContainText('Piso 1');
  await page.click('#rec-niveles button:has-text("Piso 2")');
  await expect(page.locator('#rec-nivel')).toContainText('Piso 2');
  await page.selectOption('#rec-destinos', { label: 'Salón 305' });
  await expect(page.locator('#rec-lugar')).toContainText('Salón 305');
  await page.click('#rec-salir');
  await expect(page.locator('#recorrido')).toBeHidden();
});
