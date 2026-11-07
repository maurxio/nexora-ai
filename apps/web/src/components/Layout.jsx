import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { organizationsApi } from '../api/client.js';
import { useSession } from '../auth/SessionContext.jsx';
import { ErrorMessage, Loading } from './Ui.jsx';

export default function Layout() {
  const { orgId } = useParams();
  const { user, signOut } = useSession();
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState([]);
  const [organization, setOrganization] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;
    const load = async () => {
      try {
        const [list, current] = await Promise.all([organizationsApi.list(), organizationsApi.get(orgId)]);
        if (!cancelado) {
          setOrganizations(list);
          setOrganization(current);
        }
      } catch (loadError) {
        if (!cancelado) setError(loadError);
      } finally {
        if (!cancelado) setLoading(false);
      }
    };
    load();
    return () => { cancelado = true; };
  }, [orgId]);

  if (loading) return <Loading />;
  if (error) return <main className="mx-auto max-w-3xl p-6"><ErrorMessage error={error} /><Link className="mt-4 inline-block text-blue-700 underline" to="/orgs">Volver a organizaciones</Link></main>;
  const membership = organizations.find((item) => item.id === orgId);
  const role = membership?.role;
  const leave = async () => { await signOut(); navigate('/login'); };
  return <div className="min-h-screen">
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-4">
        <Link to="/orgs" className="mr-auto text-lg font-bold text-slate-900">NEXORA AI</Link>
        <select value={orgId} onChange={(event) => navigate(`/o/${event.target.value}/agents`)} className="rounded border border-slate-300 px-2 py-1 text-sm">
          {organizations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        <nav className="flex gap-3 text-sm"><NavLink to={`/o/${orgId}/agents`} className="text-blue-700">Agentes</NavLink><NavLink to={`/o/${orgId}/workflows`} className="text-blue-700">Workflows</NavLink></nav>
        <span className="text-sm text-slate-600">{user?.name}</span><button onClick={leave} className="text-sm text-slate-600 underline">Salir</button>
      </div>
    </header>
    <main className="mx-auto max-w-6xl p-4"><h1 className="mb-6 text-2xl font-bold">{organization.name}</h1><Outlet context={{ role, organization }} /></main>
  </div>;
}
