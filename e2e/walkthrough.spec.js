import { test, expect } from '@playwright/test';
import { fakeApi, enterAsGuest } from './fakeApi.js';

/**
 * Builds every floor of blocks A and B with the real Kit (walls, furniture, stairs) and checks:
 *  - that no destination of the "Ir a…" menu is inside a piece of furniture or a wall,
 *  - that from the first destination you can walk to all the others,
 *  - that every staircase or passage between blocks leads to a destination that exists.
 */
test('every floor can be walked and every destination is reachable', async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto('/');
  const report = await page.evaluate(async () => {
    const { Kit } = await import('/src/walkthrough.js');
    const { INTERIORS } = await import('/src/floorPlans.js');
    const problems = [];
    let floors = 0, destinations = 0;
    for (const [bCode, bld] of Object.entries(INTERIORS)) {
      for (const n of bld.levels) {
        const k = new Kit({ add() {} }, n.style ?? {});
        k.destinations = [...(n.destinations ?? [])];
        n.build(k);
        floors++; destinations += k.destinations.length;
        const L = k.bounds, h = 0.2;
        const W = Math.round((L.x1 - L.x0) / h), H = Math.round((L.z1 - L.z0) / h);
        const idx = (i, j) => j * (W + 1) + i;
        const cell = (x, z) => [Math.round((x - L.x0) / h), Math.round((z - L.z0) / h)];
        for (const d of k.destinations) if (!k.isFree(d.x, d.z)) problems.push(`${bCode}${n.id}: blocked destination ${d.id}`);
        const start = k.destinations.find(d => k.isFree(d.x, d.z));
        const vis = new Uint8Array((W + 1) * (H + 1));
        const queue = [cell(start.x, start.z)];
        vis[idx(...queue[0])] = 1;
        while (queue.length) {
          const [i, j] = queue.pop();
          for (const [a, c] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
            if (a < 0 || c < 0 || a > W || c > H || vis[idx(a, c)] || !k.isFree(L.x0 + a * h, L.z0 + c * h)) continue;
            vis[idx(a, c)] = 1; queue.push([a, c]);
          }
        }
        for (const d of k.destinations) {
          const [i, j] = cell(d.x, d.z);
          let ok = false;
          for (let a = -2; a <= 2 && !ok; a++) for (let c = -2; c <= 2 && !ok; c++) ok = vis[idx(i + a, j + c)] === 1;
          if (!ok) problems.push(`${bCode}${n.id}: cannot reach ${d.id}`);
        }
        for (const p of k.portals) {
          const targetBuilding = INTERIORS[p.building ?? bCode];
          const level = targetBuilding?.levels.find(m => m.id === p.level);
          if (!level || !(level.destinations ?? []).some(d => d.id === p.arrival))
            problems.push(`${bCode}${n.id}: portal to ${p.building ?? bCode}${p.level}/${p.arrival} without arrival`);
        }
      }
    }
    return { floors, destinations, problems };
  });
  expect(report.problems).toEqual([]);
  expect(report.floors).toBe(16);
  expect(report.destinations).toBeGreaterThan(140);
});

test('going up the stairs changes the floor', async ({ page }) => {
  await fakeApi(page);
  await enterAsGuest(page);
  await page.evaluate(() => window.ucc3d.walkthrough.openAt('B', 1, 'stairs'));
  await expect(page.locator('#rec-level')).toContainText('Piso 1');
  await page.click('#rec-levels button:has-text("Piso 2")');
  await expect(page.locator('#rec-level')).toContainText('Piso 2');
  await page.selectOption('#rec-destinations', { label: 'Salón 305' });
  await expect(page.locator('#rec-place')).toContainText('Salón 305');
  await page.click('#rec-exit');
  await expect(page.locator('#walkthrough')).toBeHidden();
});
