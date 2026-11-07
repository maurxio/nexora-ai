import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { organizationsApi } from '../api/client.js';
import { Button, Empty, ErrorMessage, Input, Loading } from '../components/Ui.jsx';

export default function OrgsPage() {
  const [items, setItems] = useState(null); const [error, setError] = useState(null); const [name, setName] = useState(''); const [sending, setSending] = useState(false); const navigate = useNavigate();
  const load = () => organizationsApi.list().then(setItems).catch(setError);
  useEffect(() => {
    let cancelado = false;
    const loadOrganizations = async () => {
      try {
        const organizations = await organizationsApi.list();
        if (!cancelado) setItems(organizations);
      } catch (loadError) {
        if (!cancelado) setError(loadError);
      }
    };
    loadOrganizations();
    return () => { cancelado = true; };
  }, []);
  const create = async (event) => { event.preventDefault(); setSending(true); setError(null); try { const org = await organizationsApi.create({ name }); navigate(`/o/${org.id}/agents`); } catch (err) { setError(err); } finally { setSending(false); } };
  if (!items && !error) return <Loading />;
  if (!items) return <main className="mx-auto max-w-3xl p-4"><ErrorMessage error={error} /></main>;
  return <main className="mx-auto max-w-3xl space-y-6 p-4"><h1 className="text-2xl font-bold">Mis organizaciones</h1><ErrorMessage error={error} />{items.length ? <div className="grid gap-3">{items.map((org) => <Link key={org.id} to={`/o/${org.id}/agents`} className="rounded-lg bg-white p-4 shadow-sm hover:ring-2 hover:ring-blue-200"><strong>{org.name}</strong><span className="ml-3 text-sm text-slate-500">{org.role}</span></Link>)}</div> : <Empty>Aún no tienes organizaciones.</Empty>}<form onSubmit={create} className="space-y-3 rounded-lg bg-white p-4 shadow-sm"><h2 className="font-semibold">Crear organización</h2><Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} required /><Button disabled={sending}>{sending ? 'Creando...' : 'Crear organización'}</Button></form></main>;
}
