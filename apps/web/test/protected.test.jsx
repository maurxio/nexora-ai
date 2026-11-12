import React from 'react';
import { test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../src/auth/ProtectedRoute.jsx';
import { useSession } from '../src/auth/SessionContext.jsx';
vi.mock('../src/auth/SessionContext.jsx', () => ({ useSession: vi.fn() }));
for (const [name, state, expected] of [
  ['loading', { loading: true }, 'Cargando sesión...'],
  ['anonymous', { loading: false, user: null }, 'Login required'],
  ['authenticated', { loading: false, user: { id: 'u' } }, 'Private dashboard'],
])
  test(`protected navigation: ${name}`, () => {
    useSession.mockReturnValue(state);
    render(
      <MemoryRouter initialEntries={['/private']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/private" element={<p>Private dashboard</p>} />
          </Route>
          <Route path="/login" element={<p>Login required</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText(expected)).toBeInTheDocument();
  });
