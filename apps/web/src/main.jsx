import { EmptyState, PageHeader } from './components/Ui.jsx';
import Protected from './auth/ProtectedRoute.jsx';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import './index.css';
import { ThemeProvider } from './theme/ThemeContext.jsx';
import { SessionProvider } from './auth/SessionContext.jsx';
import Layout from './components/Layout.jsx';
import { Login, Register } from './pages/AuthPages.jsx';
import AgentsPage from './pages/AgentsPage.jsx';
import NotFound from './pages/NotFound.jsx';
import OrgsPage from './pages/OrgsPage.jsx';
import WorkflowDetailPage from './pages/WorkflowDetailPage.jsx';
import WorkflowsPage from './pages/WorkflowsPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import {
  ApprovalsPage,
  AnalyticsPage,
  DocumentsPage,
  IntegrationsPage,
  NotificationsPage,
  RunDetailPage,
  RunsPage,
} from './pages/OperationsPages.jsx';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <main className="mx-auto max-w-xl p-8 text-center">
          <h1 className="text-2xl font-bold">Ocurrió un error inesperado</h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300">{this.state.error.message}</p>
          <a className="mt-4 inline-block text-blue-700 dark:text-blue-300 underline" href="/orgs">
            Ir a organizaciones
          </a>
        </main>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <SessionProvider>
      <ErrorBoundary>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route element={<Protected />}>
            <Route path="/orgs" element={<OrgsPage />} />
            <Route path="/o/:orgId" element={<Layout />}>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="agents" element={<AgentsPage />} />
              <Route path="workflows" element={<WorkflowsPage />} />
              <Route path="workflows/:id" element={<WorkflowDetailPage />} />
              <Route path="runs" element={<RunsPage />} />
              <Route path="runs/:id" element={<RunDetailPage />} />
              <Route path="approvals" element={<ApprovalsPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="integrations" element={<IntegrationsPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Route>
          <Route path="/" element={<Navigate to="/orgs" replace />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </ErrorBoundary>
    </SessionProvider>
  );
}

function SettingsPage() {
  return (
    <section>
      <PageHeader
        title="Configuración"
        description="Preferencias y administración de tu organización."
      />
      <EmptyState
        title="Configuración avanzada pendiente"
        description="La administración de miembros, roles y preferencias estará disponible en esta sección."
      />
    </section>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>,
);
