import { useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { workflowsApi } from '../api/client.js';
import WorkflowDraft from '../components/WorkflowDraft.jsx';
import { Button, Empty, ErrorMessage, Input, Loading } from '../components/Ui.jsx';

export default function WorkflowDetailPage() {
  const { orgId, id } = useParams(); const { role } = useOutletContext(); const editable = role === 'ADMIN' || role === 'OPERATOR';
  const [workflow, setWorkflow] = useState(null); const [versions, setVersions] = useState([]); const [definition, setDefinition] = useState(''); const [error, setError] = useState(null); const [sending, setSending] = useState(false); const [selectedVersion, setSelectedVersion] = useState(null);
  const load = () => Promise.all([workflowsApi.get(orgId, id), workflowsApi.versions(orgId, id)]).then(([item, list]) => { setWorkflow(item); setDefinition(JSON.stringify(item.draft ?? {}, null, 2)); setVersions(list); }).catch(setError);
  useEffect(() => {
    let cancelado = false;
    const loadWorkflow = async () => {
      try {
        const [item, list] = await Promise.all([workflowsApi.get(orgId, id), workflowsApi.versions(orgId, id)]);
        if (!cancelado) {
          setWorkflow(item);
          setDefinition(JSON.stringify(item.draft ?? {}, null, 2));
          setVersions(list);
        }
      } catch (loadError) {
        if (!cancelado) setError(loadError);
      }
    };
    loadWorkflow();
    return () => { cancelado = true; };
  }, [orgId, id]);
  const save = async () => { let draft; try { draft = JSON.parse(definition); } catch { setError(new Error('El borrador no contiene un JSON válido.')); return null; } return workflowsApi.update(orgId, id, { name: workflow.name, description: workflow.description, draft }); };
  const saveDraft = async () => { setSending(true); setError(null); try { await save(); } catch (err) { setError(err); } finally { setSending(false); } };
  const publish = async () => { setSending(true); setError(null); try { await save(); await workflowsApi.publish(orgId, id); load(); } catch (err) { setError(err); } finally { setSending(false); } };
  const showVersion = async (version) => { setError(null); try { setSelectedVersion(await workflowsApi.version(orgId, id, version)); } catch (err) { setError(err); } };
  if (!workflow && !error) return <Loading />;
  if (!workflow) return <section><ErrorMessage error={error} /></section>;
  return <section className="space-y-5"><Link className="text-sm text-blue-700 underline" to={`/o/${orgId}/workflows`}>← Volver a workflows</Link><div className="space-y-3 rounded-lg bg-white p-4 shadow-sm"><Input label="Nombre" value={workflow.name} onChange={(e) => setWorkflow({ ...workflow, name: e.target.value })} disabled={!editable} /><Input label="Descripción" value={workflow.description || ''} onChange={(e) => setWorkflow({ ...workflow, description: e.target.value })} disabled={!editable} /><h2 className="font-semibold">Borrador</h2><WorkflowDraft value={definition} onChange={setDefinition} disabled={!editable} />{editable && <div className="flex flex-wrap gap-2"><Button disabled={sending} onClick={saveDraft}>{sending ? 'Guardando...' : 'Guardar borrador'}</Button><Button disabled={sending} onClick={publish} className="bg-emerald-700 hover:bg-emerald-800">Publicar</Button></div>}<ErrorMessage error={error} />{error?.data?.problems && <ul className="list-disc pl-5 text-sm text-red-700">{error.data.problems.map((problem) => <li key={problem}>{problem}</li>)}</ul>}</div><div className="rounded-lg bg-white p-4 shadow-sm"><h2 className="mb-3 font-semibold">Versiones publicadas</h2>{versions.length === 0 ? <Empty>Aún no hay versiones publicadas.</Empty> : <ul className="space-y-2">{versions.map((version) => <li key={version.version}><button className="text-left text-blue-700 underline" onClick={() => showVersion(version.version)}>Versión {version.version} — {new Date(version.createdAt).toLocaleString('es')}</button></li>)}</ul>}{selectedVersion && <div className="mt-4"><h3 className="mb-2 font-medium">Definición de la versión {selectedVersion.version}</h3><pre className="overflow-x-auto rounded bg-slate-950 p-4 text-sm text-green-200">{JSON.stringify(selectedVersion.definition, null, 2)}</pre></div>}</div></section>;
}
