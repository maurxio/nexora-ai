const { test, expect } = require('@playwright/test');
test('login → dashboard → create workflow', async ({ page, request }) => {
  const email = `e2e-${Date.now()}@test.local`;
  const password = 'Test-password-123';
  const registration = await request.post('http://127.0.0.1:3101/api/v1/auth/register', {
    data: { name: 'Smoke', email, password },
  });
  expect(registration.ok()).toBeTruthy();
  const { accessToken } = await registration.json();
  const org = await request.post('http://127.0.0.1:3101/api/v1/organizations', {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { name: `Smoke ${Date.now()}` },
  });
  expect(org.ok()).toBeTruthy();
  const { id } = await org.json();
  await page.goto('/login');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByText('Mis organizaciones')).toBeVisible();
  await page.goto(`/o/${id}/dashboard`);
  await expect(page.getByRole('heading', { name: /Resumen/ })).toBeVisible();
  await page.goto(`/o/${id}/workflows`);
  await page.getByLabel('Nombre', { exact: true }).fill('Smoke workflow');
  await page
    .getByRole('button', { name: /Crear workflow/i })
    .last()
    .click();
  await expect(page).toHaveURL(new RegExp(`/o/${id}/workflows/[^/]+$`));
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Smoke workflow');
  await page.goto(`/o/${id}/workflows`);
  await page.getByRole('link', { name: 'Smoke workflow', exact: true }).click();
  await expect(page.getByLabel('Nombre', { exact: true })).toHaveValue('Smoke workflow');
});
