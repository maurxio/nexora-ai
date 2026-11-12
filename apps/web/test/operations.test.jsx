import React from 'react';
import { test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, Outlet } from 'react-router-dom';
import * as api from '../src/api/client.js';
import * as pages from '../src/pages/OperationsPages.jsx';
import DashboardPage from '../src/pages/DashboardPage.jsx';
import AgentsPage from '../src/pages/AgentsPage.jsx';
import WorkflowsPage from '../src/pages/WorkflowsPage.jsx';
import WorkflowDetailPage from '../src/pages/WorkflowDetailPage.jsx';
vi.mock('../src/components/WorkflowEditor.jsx', () => ({
  default: (props) => (
    <div>
      <p>Workflow canvas</p>
      <button onClick={() => props.onTest()}>Open test</button>
      <button onClick={() => props.onPublish()}>Publish test</button>
      <button onClick={() => props.onValidate(['Missing trigger'])}>Validate test</button>
    </div>
  ),
}));
vi.mock('../src/api/client.js', () => {
  const methods = [
    'list',
    'get',
    'steps',
    'create',
    'update',
    'remove',
    'tools',
    'catalog',
    'versions',
    'version',
    'execute',
    'publish',
    'approve',
    'reject',
    'markRead',
    'markAllRead',
    'overview',
    'errors',
  ];
  const make = () => Object.fromEntries(methods.map((name) => [name, vi.fn()]));
  return Object.fromEntries(
    [
      'agentsApi',
      'workflowsApi',
      'executionsApi',
      'approvalsApi',
      'notificationsApi',
      'documentsApi',
      'integrationsApi',
      'analyticsApi',
    ].map((name) => [name, make()]),
  );
});
const now = '2026-01-01T00:00:00Z';
const overview = {
  totalExecutions: 2,
  successRate: 1,
  p95DurationMs: 10,
  averageDurationMs: 5,
  pendingApprovals: 1,
  documentsProcessed: 1,
};
function mount(Component, role = 'ADMIN') {
  render(
    <MemoryRouter initialEntries={['/o/acme/resource/one']}>
      <Routes>
        <Route path="/o/:orgId" element={<Outlet context={{ role }} />}>
          <Route path="resource/:id" element={<Component />} />
          <Route path="workflows/:wid" element={<p>Workflow created</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
  api.analyticsApi.overview.mockResolvedValue(overview);
  api.analyticsApi.errors.mockResolvedValue([]);
  api.executionsApi.list.mockResolvedValue({ items: [] });
  api.agentsApi.list.mockResolvedValue([]);
  api.agentsApi.catalog.mockResolvedValue([]);
});
const cases = [
  [pages.RunsPage, api.executionsApi.list, { items: [] }, 'No hay ejecuciones para este filtro.'],
  [
    pages.ApprovalsPage,
    api.approvalsApi.list,
    { items: [] },
    'No hay aprobaciones en esta bandeja.',
  ],
  [pages.NotificationsPage, api.notificationsApi.list, { items: [] }, 'No tienes notificaciones.'],
  [pages.DocumentsPage, api.documentsApi.list, { data: [] }, 'No hay documentos cargados.'],
  [pages.IntegrationsPage, api.integrationsApi.list, [], 'No hay conectores configurados.'],
  [pages.AnalyticsPage, api.analyticsApi.overview, overview, 'No se registraron errores.'],
  [DashboardPage, api.analyticsApi.overview, overview, 'Ejecuciones recientes'],
  [AgentsPage, api.agentsApi.list, [], 'Aún no hay agentes.'],
  [WorkflowsPage, api.workflowsApi.list, [], 'Aún no hay workflows.'],
];
for (const [Component, method, value, text] of cases) {
  test(`${Component.name} renders loading and empty/success state`, async () => {
    method.mockResolvedValue(value);
    mount(Component);
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
    expect(await screen.findByText(text)).toBeInTheDocument();
  });
  test(`${Component.name} renders API error`, async () => {
    method.mockRejectedValue(new Error('API unavailable'));
    mount(Component);
    expect(await screen.findByText('API unavailable')).toBeInTheDocument();
  });
}
test('approvals require rejection comment and submit decision', async () => {
  api.approvalsApi.list.mockResolvedValue({
    items: [{ id: 'a', title: 'Invoice', payload: {}, status: 'PENDING', createdAt: now }],
  });
  api.approvalsApi.reject.mockResolvedValue({});
  mount(pages.ApprovalsPage);
  fireEvent.click(await screen.findByRole('button', { name: 'Revisar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
  expect(screen.getByText('El comentario es obligatorio al rechazar.')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Comentario (obligatorio para rechazar)'), {
    target: { value: 'Incorrect total' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
  await waitFor(() =>
    expect(api.approvalsApi.reject).toHaveBeenCalledWith('acme', 'a', 'Incorrect total'),
  );
});
test('operational lists show document and connector records', async () => {
  api.documentsApi.list.mockResolvedValue({
    data: [{ id: 'd', originalName: 'invoice.pdf', status: 'VALIDATED', createdAt: now }],
  });
  mount(pages.DocumentsPage);
  expect(await screen.findByText('invoice.pdf')).toBeInTheDocument();
});
test('run detail shows timeline and input', async () => {
  api.executionsApi.get.mockResolvedValue({ id: 'r', status: 'SUCCEEDED', input: { amount: 12 } });
  api.executionsApi.steps.mockResolvedValue([
    { nodeId: 'start', nodeType: 'trigger', status: 'SUCCEEDED', startedAt: now },
  ]);
  mount(pages.RunDetailPage);
  expect(await screen.findByText('trigger')).toBeInTheDocument();
});
test('workflow creation submits and navigates', async () => {
  api.workflowsApi.list.mockResolvedValue([]);
  api.workflowsApi.create.mockResolvedValue({ id: 'created' });
  mount(WorkflowsPage);
  await screen.findByText('Aún no hay workflows.');
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Created workflow' } });
  fireEvent.click(screen.getByRole('button', { name: 'Crear workflow' }));
  expect(await screen.findByText('Workflow created')).toBeInTheDocument();
});
test('auditor cannot see workflow creation form', async () => {
  api.workflowsApi.list.mockResolvedValue([]);
  mount(WorkflowsPage, 'AUDITOR');
  await screen.findByText('Aún no hay workflows.');
  expect(screen.queryByRole('button', { name: 'Crear workflow' })).toBeNull();
});
test('agent form saves valid input and tools', async () => {
  api.agentsApi.create.mockResolvedValue({ id: 'a', organizationId: 'acme' });
  api.agentsApi.tools.mockResolvedValue({});
  mount(AgentsPage);
  fireEvent.click(await screen.findByRole('button', { name: 'Nuevo agente' }));
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'New agent' } });
  fireEvent.change(screen.getByLabelText('Instrucciones del sistema'), {
    target: { value: 'Be deterministic' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
  await waitFor(() => expect(api.agentsApi.tools).toHaveBeenCalledWith('acme', 'a', []));
});
test('workflow detail loads editor and saved versions', async () => {
  api.workflowsApi.get.mockResolvedValue({
    id: 'one',
    name: 'Workflow detail',
    draft: { nodes: [], edges: [] },
  });
  api.workflowsApi.versions.mockResolvedValue([]);
  mount(WorkflowDetailPage);
  expect(await screen.findByText('Workflow canvas')).toBeInTheDocument();
});

test('workflow detail saves metadata, validates draft and executes input', async () => {
  const workflow = { id: 'one', name: 'Workflow detail', draft: { nodes: [], edges: [] } };
  api.workflowsApi.get.mockResolvedValue(workflow);
  api.workflowsApi.update.mockResolvedValue(workflow);
  api.workflowsApi.versions.mockResolvedValue([{ version: 1, createdAt: now }]);
  api.workflowsApi.version.mockResolvedValue({ version: 1 });
  api.workflowsApi.execute.mockResolvedValue({ executionId: 'run', status: 'QUEUED' });
  api.executionsApi.steps.mockResolvedValue([]);
  mount(WorkflowDetailPage);
  await screen.findByText('Workflow canvas');
  fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Updated' } });
  fireEvent.click(screen.getByText('Guardar cambios del nombre y descripción'));
  await waitFor(() => expect(api.workflowsApi.update).toHaveBeenCalled());
  fireEvent.click(screen.getByText('Validate test'));
  expect(screen.getByText('Missing trigger')).toBeInTheDocument();
  fireEvent.click(screen.getByText(/Versión 1 —/));
  expect(
    await screen.findByText('Las versiones publicadas son de solo lectura y no se pueden editar.'),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByText('Open test'));
  fireEvent.change(screen.getByPlaceholderText('Campo'), { target: { value: 'invoice' } });
  fireEvent.change(screen.getByPlaceholderText('Valor'), { target: { value: '123' } });
  fireEvent.click(screen.getByRole('button', { name: 'Ejecutar', exact: true }));
  expect(await screen.findByText('Ejecución QUEUED')).toBeInTheDocument();
  expect(api.workflowsApi.execute).toHaveBeenCalledWith('acme', 'one', {
    input: { invoice: '123' },
  });
});
