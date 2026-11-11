import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import './index.css';
import { SessionProvider, useSession } from './auth/SessionContext.jsx';
import Layout from './components/Layout.jsx';
import { Login, Register } from './pages/AuthPages.jsx';
import AgentsPage from './pages/AgentsPage.jsx';
import NotFound from './pages/NotFound.jsx';
import OrgsPage from './pages/OrgsPage.jsx';
import WorkflowDetailPage from './pages/WorkflowDetailPage.jsx';
import WorkflowsPage from './pages/WorkflowsPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import { ApprovalsPage, AnalyticsPage, DocumentsPage, IntegrationsPage, NotificationsPage, RunDetailPage, RunsPage } from './pages/OperationsPages.jsx';

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
      return <main className="mx-auto max-w-xl p-8 text-center"><h1 className="text-2xl font-bold">Ocurrió un error inesperado</h1><p className="mt-3 text-slate-600">{this.state.error.message}</p><a className="mt-4 inline-block text-blue-700 underline" href="/orgs">Ir a organizaciones</a></main>;
    }
    return this.props.children;
  }
}

function Protected() {
  const { user, loading } = useSession();
  if (loading) return <p className="p-8 text-center text-slate-500">Cargando sesión...</p>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

function App() {
  return <SessionProvider><ErrorBoundary><Routes><Route path="/login" element={<Login />} /><Route path="/register" element={<Register />} /><Route element={<Protected />}><Route path="/orgs" element={<OrgsPage />} /><Route path="/o/:orgId" element={<Layout />}><Route index element={<Navigate to="dashboard" replace />} /><Route path="dashboard" element={<DashboardPage />} /><Route path="agents" element={<AgentsPage />} /><Route path="workflows" element={<WorkflowsPage />} /><Route path="workflows/:id" element={<WorkflowDetailPage />} /><Route path="runs" element={<RunsPage />} /><Route path="runs/:id" element={<RunDetailPage />} /><Route path="approvals" element={<ApprovalsPage />} /><Route path="notifications" element={<NotificationsPage />} /><Route path="documents" element={<DocumentsPage />} /><Route path="integrations" element={<IntegrationsPage />} /><Route path="analytics" element={<AnalyticsPage />} /><Route path="settings" element={<SettingsPage />} /></Route></Route><Route path="/" element={<Navigate to="/orgs" replace />} /><Route path="*" element={<NotFound />} /></Routes></ErrorBoundary></SessionProvider>;
}

function SettingsPage() {
  return <main className="surface rounded-lg p-6"><h1 className="text-xl font-bold">Configuración</h1><p className="mt-2 text-sm text-slate-500">La gestión de miembros y roles está disponible desde la API. Las claves de API, preferencias avanzadas y sesiones requieren endpoints de backend aún no publicados.</p></main>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><BrowserRouter><App /></BrowserRouter></React.StrictMode>);
