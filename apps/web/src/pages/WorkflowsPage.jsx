import { useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { workflowsApi } from '../api/client.js';
import { Button, Empty, ErrorMessage, Input, Loading } from '../components/Ui.jsx';

export default function WorkflowsPage() {
  const { orgId } = useParams(); const { role } = useOutletContext(); const navigate = useNavigate();
  const [items, setItems] = useState(null); const [error, setError] = useState(null); const [form, setForm] = useState({ name: '', description: '' }); const [sending, setSending] = useState(false);
  const editable = role === 'ADMIN' || role === 'OPERATOR';
  const load = () => workflowsApi.list(orgId).then(setItems).catch(setError);
  useEffect(() => {
    let cancelado = false;
    const loadWorkflows = async () => {
      try {
        const workflows = await workflowsApi.list(orgId);
        if (!cancelado) setItems(workflows);
      } catch (loadError) {
        if (!cancelado) setError(loadError);
      }
    };
    loadWorkflows();
    return () => { cancelado = true; };
  }, [orgId]);
  const create = async (event) => { event.preventDefault(); setSending(true); setError(null); try { const workflow = await workflowsApi.create(orgId, form); if (workflow.id) navigate(`/o/${orgId}/workflows/${workflow.id}`); else load(); setForm({ name: '', description: '' }); } catch (err) { setError(err); } finally { setSending(false); } };
  const remove = async (workflow) => { if (!workflow.id || !window.confirm(`¿Borrar el workflow "${workflow.name}"?`)) return; try { await workflowsApi.remove(orgId, workflow.id); load(); } catch (err) { setError(err); } };
  if (!items && !error) return <Loading />;
  if (!items) return <section><ErrorMessage error={error} /></section>;
  return <section className="space-y-5"><h2 className="text-xl font-semibold">Workflows</h2><ErrorMessage error={error} />{items.length === 0 ? <Empty>Aún no hay workflows.</Empty> : <div className="overflow-x-auto rounded-lg bg-white shadow-sm"><table className="w-full min-w-[650px] text-left text-sm"><thead className="border-b text-slate-500"><tr><th className="p-3">Nombre</th><th className="p-3">Descripción</th><th className="p-3">Última versión</th><th className="p-3">Actualizado</th><th className="p-3">Acciones</th></tr></thead><tbody>{items.map((workflow) => <tr key={workflow.id || workflow.name} className="border-b last:border-0"><td className="p-3 font-medium">{workflow.id ? <Link className="text-blue-700 underline" to={`/o/${orgId}/workflows/${workflow.id}`}>{workflow.name}</Link> : workflow.name}</td><td className="p-3">{workflow.description || '—'}</td><td className="p-3">{workflow.latestVersion == null ? 'Sin publicar' : `v${workflow.latestVersion}`}</td><td className="p-3">{workflow.updatedAt ? new Date(workflow.updatedAt).toLocaleString('es') : '—'}</td><td className="p-3">{role === 'ADMIN' && <button disabled={!workflow.id} className="text-red-700 underline disabled:opacity-40" onClick={() => remove(workflow)}>Borrar</button>}</td></tr>)}</tbody></table></div>}{editable && <form onSubmit={create} className="space-y-3 rounded-lg bg-white p-4 shadow-sm"><h3 className="font-semibold">Crear workflow</h3><Input label="Nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /><Input label="Descripción" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /><Button disabled={sending}>{sending ? 'Creando...' : 'Crear workflow'}</Button></form>}</section>;
}
