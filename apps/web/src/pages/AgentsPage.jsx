import { useEffect, useState } from 'react';
import { useOutletContext, useParams } from 'react-router-dom';
import { agentsApi } from '../api/client.js';
import { Button, Empty, ErrorMessage, Input, Loading } from '../components/Ui.jsx';

const emptyForm = { name: '', description: '', systemInstructions: '', model: '', maxStepsPerRun: 5, monthlyTokenBudget: '' };
const toolNames = (agent) => (agent?.tools || []).map((tool) => typeof tool === 'string' ? tool : tool.toolName || tool.name);

function AgentForm({ agent, orgId, catalog, role, error, onDone, onError }) {
  const [form, setForm] = useState(agent ? { ...emptyForm, ...agent, monthlyTokenBudget: agent.monthlyTokenBudget || '' } : emptyForm);
  const [selected, setSelected] = useState(toolNames(agent)); const [sending, setSending] = useState(false);
  const editable = role === 'ADMIN' || role === 'OPERATOR';
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const save = async (event) => {
    event.preventDefault(); setSending(true); onError(null);
    try {
      const payload = { ...form, maxStepsPerRun: Number(form.maxStepsPerRun) };
      if (form.monthlyTokenBudget === '') delete payload.monthlyTokenBudget; else payload.monthlyTokenBudget = Number(form.monthlyTokenBudget);
      delete payload.tools; delete payload.id; delete payload.organizationId; delete payload.createdAt; delete payload.updatedAt;
      const saved = agent ? await agentsApi.update(orgId, agent.id, payload) : await agentsApi.create(orgId, payload);
      await agentsApi.tools(saved.organizationId, saved.id, selected); onDone();
    } catch (error) { onError(error); } finally { setSending(false); }
  };
  return <form onSubmit={save} className="space-y-3 rounded-lg bg-white p-4 shadow-sm"><h2 className="font-semibold">{agent ? 'Editar agente' : 'Nuevo agente'}</h2><Input label="Nombre" value={form.name} onChange={(e) => update('name', e.target.value)} disabled={!editable} required />{error?.status === 409 && <ErrorMessage error={error} />}<Input label="Descripción" value={form.description} onChange={(e) => update('description', e.target.value)} disabled={!editable} /><label className="block text-sm font-medium text-slate-700">Instrucciones del sistema<textarea className="mt-1 min-h-24 w-full rounded-lg border border-slate-300 p-2" value={form.systemInstructions} onChange={(e) => update('systemInstructions', e.target.value)} disabled={!editable} required /></label><div className="grid gap-3 sm:grid-cols-3"><Input label="Modelo" value={form.model} onChange={(e) => update('model', e.target.value)} disabled={!editable} /><Input label="Máximo de pasos" type="number" min="1" max="25" value={form.maxStepsPerRun} onChange={(e) => update('maxStepsPerRun', e.target.value)} disabled={!editable} /><Input label="Presupuesto mensual (tokens)" type="number" value={form.monthlyTokenBudget} onChange={(e) => update('monthlyTokenBudget', e.target.value)} disabled={!editable} /></div><fieldset><legend className="mb-2 text-sm font-medium">Herramientas</legend><div className="grid gap-2 sm:grid-cols-2">{catalog.map((tool) => <label key={tool.name} className="text-sm"><input type="checkbox" className="mr-2" checked={selected.includes(tool.name)} onChange={() => setSelected((current) => current.includes(tool.name) ? current.filter((name) => name !== tool.name) : [...current, tool.name])} disabled={!editable} />{tool.name}<span className="ml-1 text-slate-500">— {tool.description}</span></label>)}</div></fieldset>{editable && <Button disabled={sending}>{sending ? 'Guardando...' : 'Guardar'}</Button>}</form>;
}

export default function AgentsPage() {
  const { orgId } = useParams(); const { role } = useOutletContext();
  const [agents, setAgents] = useState(null); const [catalog, setCatalog] = useState([]); const [error, setError] = useState(null); const [editing, setEditing] = useState(null);
  const load = () => Promise.all([agentsApi.list(orgId), agentsApi.catalog(orgId)]).then(([list, tools]) => { setAgents(list); setCatalog(tools); }).catch(setError);
  useEffect(() => {
    let cancelado = false;
    const loadAgents = async () => {
      try {
        const [list, tools] = await Promise.all([agentsApi.list(orgId), agentsApi.catalog(orgId)]);
        if (!cancelado) {
          setAgents(list);
          setCatalog(tools);
        }
      } catch (loadError) {
        if (!cancelado) setError(loadError);
      }
    };
    loadAgents();
    return () => { cancelado = true; };
  }, [orgId]);
  const remove = async (agent) => { if (!window.confirm(`¿Borrar el agente "${agent.name}"?`)) return; try { await agentsApi.remove(orgId, agent.id); load(); } catch (err) { setError(err); } };
  if (!agents && !error) return <Loading />;
  if (!agents) return <section><ErrorMessage error={error} /></section>;
  return <section className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-semibold">Agentes</h2><p className="text-sm text-slate-500">Configura los agentes de esta organización.</p></div>{(role === 'ADMIN' || role === 'OPERATOR') && <Button onClick={() => setEditing({ organizationId: orgId })}>Nuevo agente</Button>}</div>{error?.status !== 409 && <ErrorMessage error={error} />}{editing && <AgentForm agent={editing.id ? editing : null} orgId={orgId} catalog={catalog} role={role} error={error} onError={setError} onDone={() => { setEditing(null); load(); }} />}{agents.length === 0 ? <Empty>Aún no hay agentes.</Empty> : <div className="overflow-x-auto rounded-lg bg-white shadow-sm"><table className="w-full min-w-[650px] text-left text-sm"><thead className="border-b text-slate-500"><tr><th className="p-3">Nombre</th><th className="p-3">Descripción</th><th className="p-3">Modelo</th><th className="p-3">Herramientas</th><th className="p-3">Acciones</th></tr></thead><tbody>{agents.map((agent) => <tr key={agent.id} className="border-b last:border-0"><td className="p-3 font-medium">{agent.name}</td><td className="p-3">{agent.description || '—'}</td><td className="p-3">{agent.model || '—'}</td><td className="p-3">{toolNames(agent).join(', ') || '—'}</td><td className="p-3"><div className="flex gap-2">{(role === 'ADMIN' || role === 'OPERATOR') && <button className="text-blue-700 underline" onClick={() => setEditing(agent)}>Editar</button>}{role === 'ADMIN' && <button className="text-red-700 underline" onClick={() => remove(agent)}>Borrar</button>}</div></td></tr>)}</tbody></table></div>}</section>;
}
