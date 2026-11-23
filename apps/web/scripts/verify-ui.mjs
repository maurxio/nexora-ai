// Standalone browser checks. Run against Vite: node apps/web/scripts/verify-ui.mjs
// All API responses are isolated fixtures; no production data is accessed.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
const browser = await chromium.launch({ headless: true });
const base = process.env.NEXORA_UI_URL || 'http://127.0.0.1:5173';
const date = '2026-11-12T14:00:00Z';
const runs = Array.from({ length: 12 }, (_, i) => ({
  id: `run-${i}`,
  workflowId: 'workflow-1',
  status: i % 3 ? 'SUCCEEDED' : 'FAILED',
  createdAt: date,
}));
const errors = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.on('pageerror', (error) => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('nexora_refresh', 'fixture'));
await page.route('**/api/v1/**', (route) => {
  const path = new URL(route.request().url()).pathname;
  let data;
  if (path.endsWith('/auth/refresh')) data = { accessToken: 'fixture', refreshToken: 'fixture' };
  else if (path.endsWith('/auth/me')) data = { id: 'user', name: 'Ana García' };
  else if (path.endsWith('/organizations'))
    data = [{ id: 'acme', name: 'Acme Operaciones', role: 'ADMIN' }];
  else if (path.endsWith('/organizations/acme')) data = { id: 'acme', name: 'Acme Operaciones' };
  else if (path.endsWith('/unread-count')) data = { count: 3 };
  else if (path.endsWith('/overview'))
    data = {
      totalExecutions: 1254,
      successRate: 0.98,
      pendingApprovals: 7,
      documentsProcessed: 384,
      averageDurationMs: 152,
      p95DurationMs: 310,
    };
  else if (path.endsWith('/executions'))
    data = {
      items: runs.slice(0, Number(new URL(route.request().url()).searchParams.get('limit')) || 12),
    };
  else if (path.endsWith('/approvals'))
    data = {
      items: [
        {
          id: 'a',
          title: 'Revisión de factura',
          status: 'PENDING',
          payload: { total: 1200 },
          createdAt: date,
        },
      ],
    };
  else if (path.endsWith('/documents'))
    data = {
      data: [
        { id: 'd', originalName: 'Factura noviembre.pdf', status: 'VALIDATED', createdAt: date },
      ],
    };
  else if (path.endsWith('/connectors'))
    data = [
      {
        id: 'c',
        name: 'Sistema contable',
        type: 'HTTP',
        baseUrl: 'https://example.com',
        isActive: true,
      },
    ];
  else data = [];
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(data),
  });
});
try {
  await page.goto(`${base}/o/acme/dashboard`);
  await page.getByRole('heading', { name: 'Resumen', exact: true }).waitFor();
  await page.screenshot({ path: '/tmp/nexora-dashboard-light.png', fullPage: true });
  const measureContrast = () =>
    page.evaluate(() => {
      const luminance = (rgb) => {
        const values = rgb
          .match(/[\d.]+/g)
          .slice(0, 3)
          .map(Number)
          .map((c) => {
            c /= 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          });
        return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
      };
      const probe = document.createElement('span');
      document.body.append(probe);
      const color = (name) => {
        probe.style.color = `var(${name})`;
        return luminance(getComputedStyle(probe).color);
      };
      const backgrounds = ['--canvas', '--surface', '--surface-muted'];
      const results = [
        '--text',
        '--muted',
        '--tertiary',
        '--brand',
        '--success',
        '--warning',
        '--danger',
        '--info',
      ].flatMap((fg) =>
        backgrounds.map((bg) => {
          const a = color(fg),
            b = color(bg);
          return { fg, bg, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
        }),
      );
      probe.remove();
      return results;
    });
  for (const result of await measureContrast()) assert(result.ratio >= 4.5, JSON.stringify(result));
  await page.getByRole('button', { name: 'Activar modo oscuro' }).click();
  assert.equal(await page.evaluate(() => localStorage.getItem('nexora_theme')), 'dark');
  for (const result of await measureContrast()) assert(result.ratio >= 4.5, JSON.stringify(result));
  await page.screenshot({ path: '/tmp/nexora-dashboard-dark.png', fullPage: true });
  await page.reload();
  await page.getByRole('heading', { name: 'Resumen', exact: true }).waitFor();
  assert(await page.locator('html').evaluate((el) => el.classList.contains('dark')));
  await page.keyboard.press('Control+k');
  await page.getByRole('dialog', { name: 'Buscar en la navegación' }).waitFor();
  await page.getByLabel('Pantalla', { exact: true }).fill('documentos');
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Documentos', exact: true }).click();
  await page.getByRole('button', { name: 'Factura noviembre.pdf' }).click();
  await page.getByRole('dialog', { name: 'Detalle del documento' }).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(
    await page.evaluate(() => document.activeElement.textContent),
    'Factura noviembre.pdf',
  );
  await page.getByRole('link', { name: 'Aprobaciones', exact: true }).click();
  await page.getByRole('button', { name: 'Revisar', exact: true }).click();
  await page.getByRole('button', { name: 'Aprobar', exact: true }).click();
  await page.getByRole('dialog', { name: 'Aprobar solicitud', exact: true }).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Aprobar');
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Ejecuciones', exact: true }).click();
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  assert(await page.getByText('2 / 2', { exact: true }).isVisible());
  await page.getByRole('button', { name: 'Estado', exact: true }).click();
  assert.equal(await page.locator('th[aria-sort]').getAttribute('aria-sort'), 'ascending');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Abrir navegación', exact: true }).click();
  await page.getByRole('dialog', { name: 'Navegación', exact: true }).waitFor();
  await page.getByRole('dialog').getByRole('link', { name: 'Resumen', exact: true }).click();
  await page.getByRole('heading', { name: 'Resumen', exact: true }).waitFor();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: '/tmp/nexora-dashboard-mobile.png', fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    'OK: escritorio, móvil, tema persistente, navegación, foco/Escape, confirmaciones, ordenación, paginación y contraste claro y oscuro. Capturas: /tmp/nexora-dashboard-{light,dark,mobile}.png',
  );
} finally {
  await browser.close();
}
