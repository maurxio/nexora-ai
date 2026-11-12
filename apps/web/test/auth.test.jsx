import React from 'react';
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Login, Register } from '../src/pages/AuthPages.jsx';
import { SessionProvider } from '../src/auth/SessionContext.jsx';
import OrgsPage from '../src/pages/OrgsPage.jsx';
import { authApi, organizationsApi } from '../src/api/client.js';
vi.mock('../src/api/client.js', () => ({
  authApi: { login: vi.fn(), register: vi.fn(), refresh: vi.fn(), me: vi.fn() },
  organizationsApi: { list: vi.fn(), create: vi.fn() },
  setTokens: vi.fn(),
  clearSession: vi.fn(),
}));
function mount(component) {
  return render(
    <MemoryRouter>
      <SessionProvider>
        <Routes>
          <Route path="/" element={component} />
          <Route path="/orgs" element={<p>Session accepted</p>} />
          <Route path="/o/:id/agents" element={<p>Organization created</p>} />
        </Routes>
      </SessionProvider>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  vi.resetAllMocks();
});
describe('authentication', () => {
  test('validates password before making a request', () => {
    mount(<Login />);
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'qa@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'short' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByText('La contraseña debe tener al menos 8 caracteres.')).toBeInTheDocument();
    expect(authApi.login).not.toHaveBeenCalled();
  });
  test('reports loading and server errors', async () => {
    let reject;
    authApi.login.mockReturnValue(
      new Promise((_, no) => {
        reject = no;
      }),
    );
    mount(<Login />);
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'qa@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(screen.getByRole('button', { name: 'Enviando...' })).toBeDisabled();
    reject(new Error('Credenciales inválidas'));
    expect(await screen.findByText('Credenciales inválidas')).toBeInTheDocument();
  });
  test('login stores session and navigates', async () => {
    authApi.login.mockResolvedValue({
      user: { id: 'qa' },
      accessToken: 'test',
      refreshToken: 'test',
    });
    mount(<Login />);
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'qa@example.com' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('Session accepted')).toBeInTheDocument();
  });
  test('registration shows name input', () => {
    mount(<Register />);
    expect(screen.getByLabelText('Nombre')).toBeRequired();
  });
});
describe('organization list and creation', () => {
  test('shows loading, empty state, and creates resource', async () => {
    organizationsApi.list.mockResolvedValue([]);
    organizationsApi.create.mockResolvedValue({ id: 'new-org' });
    mount(<OrgsPage />);
    expect(await screen.findByText('Aún no tienes organizaciones.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'QA Organization' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear organización' }));
    await waitFor(() =>
      expect(organizationsApi.create).toHaveBeenCalledWith({ name: 'QA Organization' }),
    );
    expect(await screen.findByText('Organization created')).toBeInTheDocument();
  });
  test('shows list and load error', async () => {
    organizationsApi.list.mockRejectedValue(new Error('Servicio no disponible'));
    mount(<OrgsPage />);
    expect(await screen.findByText('Servicio no disponible')).toBeInTheDocument();
  });
  test('lists organization links', async () => {
    organizationsApi.list.mockResolvedValue([{ id: 'a', name: 'Acme', role: 'ADMIN' }]);
    mount(<OrgsPage />);
    expect(await screen.findByRole('link', { name: /Acme/ })).toHaveAttribute(
      'href',
      '/o/a/agents',
    );
  });
});
