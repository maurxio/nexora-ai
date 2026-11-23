import { useEffect, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import { agentsApi, executionsApi, workflowsApi } from '../api/client.js';
import WorkflowEditor from '../components/WorkflowEditor.jsx';
import {
  Button,
  Empty,
  ErrorMessage,
  Input,
  Loading,
  Modal,
  statusLabel,
} from '../components/Ui.jsx';

function TestDialog({ onClose, onRun, sending }) {
  const [pairs, setPairs] = useState([{ key: '', value: '' }]);
  const update = (index, key, value) =>
    setPairs((items) =>
      items.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)),
    );
  const input = Object.fromEntries(
    pairs.filter((item) => item.key.trim()).map((item) => [item.key.trim(), item.value]),
  );
  return (
    <Modal title="Probar workflow" onClose={onClose}>
      <div>
        <p className="mt-1 text-sm muted">Introduce los datos de entrada sin escribir JSON.</p>
        <div className="mt-4 space-y-2">
          {pairs.map((pair, index) => (
            <div className="flex gap-2" key={index}>
              <input
                className="control min-w-0 w-1/3"
                aria-label={`Campo ${index + 1}`}
                placeholder="Campo"
                value={pair.key}
                onChange={(e) => update(index, 'key', e.target.value)}
              />
              <input
                className="control min-w-0 flex-1"
                aria-label={`Valor ${index + 1}`}
                placeholder="Valor"
                value={pair.value}
                onChange={(e) => update(index, 'value', e.target.value)}
              />
            </div>
          ))}
        </div>
        <button
          className="mt-2 text-sm text-blue-700 dark:text-blue-300"
          onClick={() => setPairs((items) => [...items, { key: '', value: '' }])}
        >
          + Añadir campo
        </button>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button disabled={sending} onClick={() => onRun(input)}>
            {sending ? 'Ejecutando...' : 'Ejecutar'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default function WorkflowDetailPage() {
  const { orgId, id } = useParams();
  const { role } = useOutletContext();
  const editable = role === 'ADMIN' || role === 'OPERATOR';
  const [workflow, setWorkflow] = useState(null);
  const [agents, setAgents] = useState([]);
  const [versions, setVersions] = useState([]);
  const [definition, setDefinition] = useState(null);
  const [error, setError] = useState(null);
  const [problems, setProblems] = useState([]);
  const [sending, setSending] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [execution, setExecution] = useState(null);

  const load = async () => {
    try {
      const [item, list, agentList] = await Promise.all([
        workflowsApi.get(orgId, id),
        workflowsApi.versions(orgId, id),
        agentsApi.list(orgId),
      ]);
      setWorkflow(item);
      setDefinition(item.draft || { nodes: [], edges: [] });
      setVersions(list);
      setAgents(agentList);
    } catch (loadError) {
      setError(loadError);
    }
  };
  useEffect(() => {
    load();
  }, [orgId, id]);

  const save = async (nextDefinition = definition) => {
    const updated = await workflowsApi.update(orgId, id, {
      name: workflow.name,
      description: workflow.description,
      draft: nextDefinition,
    });
    setWorkflow(updated);
    setDefinition(nextDefinition);
    return updated;
  };
  const saveDraft = async (nextDefinition = definition) => {
    setSending(true);
    setError(null);
    try {
      await save(nextDefinition);
    } catch (err) {
      setError(err);
    } finally {
      setSending(false);
    }
  };
  const publish = async () => {
    if (!window.confirm('¿Publicar este workflow como una nueva versión?')) return;
    setSending(true);
    setError(null);
    try {
      await save();
      await workflowsApi.publish(orgId, id);
      await load();
    } catch (err) {
      setError(err);
    } finally {
      setSending(false);
    }
  };
  const validate = (nextProblems) => {
    setProblems(nextProblems);
    if (!nextProblems.length) setError(null);
  };
  const run = async (input) => {
    setSending(true);
    setError(null);
    try {
      const result = await workflowsApi.execute(orgId, id, { input });
      setExecution({ ...result, input });
    } catch (err) {
      setError(err);
    } finally {
      setSending(false);
      setTestOpen(false);
    }
  };
  const showVersion = async (version) => {
    try {
      setSelectedVersion(await workflowsApi.version(orgId, id, version));
    } catch (err) {
      setError(err);
    }
  };
  if (!workflow && !error) return <Loading />;
  if (!workflow)
    return (
      <section>
        <ErrorMessage error={error} />
      </section>
    );
  return (
    <section className="space-y-4">
      <Link
        className="text-sm text-blue-700 dark:text-blue-300 underline"
        to={`/o/${orgId}/workflows`}
      >
        ← Volver a workflows
      </Link>
      <div className="surface rounded-lg p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2">
          <Input
            label="Nombre"
            value={workflow.name}
            onChange={(e) => setWorkflow({ ...workflow, name: e.target.value })}
            disabled={!editable}
          />
          <Input
            label="Descripción"
            value={workflow.description || ''}
            onChange={(e) => setWorkflow({ ...workflow, description: e.target.value })}
            disabled={!editable}
          />
        </div>
        <div className="mt-4 flex items-center justify-between">
          <h2 className="font-semibold">Constructor visual</h2>
          <span className="text-sm muted">
            Versión publicada:{' '}
            {workflow.latestVersion == null ? 'ninguna' : `v${workflow.latestVersion}`}
          </span>
        </div>
        {definition && (
          <WorkflowEditor
            key={workflow.id}
            definition={definition}
            agents={agents}
            editable={editable}
            sending={sending}
            onChange={(next) => {
              setDefinition(next);
              setProblems([]);
            }}
            onSave={saveDraft}
            onValidate={validate}
            onTest={() => setTestOpen(true)}
            onPublish={publish}
          />
        )}
        {problems.length > 0 && (
          <div className="mt-3 rounded-lg bg-red-50 dark:bg-red-950 p-3 text-sm text-red-800 dark:text-red-300">
            <strong>Problemas de validación</strong>
            <ul className="mt-1 list-disc pl-5">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </div>
        )}
        {error && (
          <div className="mt-3">
            <ErrorMessage error={error} />
            {error.data?.problems && (
              <ul className="mt-2 list-disc pl-5 text-sm text-red-700 dark:text-red-300">
                {error.data.problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {editable && (
          <button
            className="mt-3 text-sm text-blue-700 dark:text-blue-300 underline"
            onClick={() => saveDraft()}
          >
            Guardar cambios del nombre y descripción
          </button>
        )}
      </div>
      {execution && <ExecutionResult orgId={orgId} execution={execution} />}
      {testOpen && <TestDialog onClose={() => setTestOpen(false)} onRun={run} sending={sending} />}
      <div className="surface rounded-lg p-4 shadow-sm">
        <h2 className="mb-3 font-semibold">Versiones publicadas</h2>
        {versions.length === 0 ? (
          <Empty>Aún no hay versiones publicadas.</Empty>
        ) : (
          <ul className="space-y-2">
            {versions.map((version) => (
              <li key={version.version}>
                <button
                  className="text-left text-blue-700 dark:text-blue-300 underline"
                  onClick={() => showVersion(version.version)}
                >
                  Versión {version.version} — {new Date(version.createdAt).toLocaleString('es')}
                </button>
              </li>
            ))}
          </ul>
        )}
        {selectedVersion && (
          <div className="mt-4 rounded bg-slate-50 dark:bg-[var(--surface-muted)] p-3 text-sm">
            <h3 className="font-medium">Versión {selectedVersion.version}</h3>
            <p className="muted">
              Las versiones publicadas son de solo lectura y no se pueden editar.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function ExecutionResult({ orgId, execution }) {
  const [steps, setSteps] = useState([]);
  useEffect(() => {
    executionsApi
      .steps(orgId, execution.executionId)
      .then(setSteps)
      .catch(() => setSteps([]));
  }, [orgId, execution.executionId]);
  return (
    <div className="surface rounded-lg p-4 shadow-sm">
      <h2 className="font-semibold">Ejecución {statusLabel(execution.status)}</h2>
      <div className="mt-2 flex flex-wrap gap-2">
        {steps.map((step) => (
          <span
            key={step.nodeId}
            className={`rounded px-2 py-1 text-xs ${step.status === 'SUCCEEDED' ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300' : step.status === 'FAILED' ? 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}
          >
            {step.nodeId}: {statusLabel(step.status)}
            {step.attempt > 1 ? ` · ${step.attempt} intentos` : ''}
          </span>
        ))}
      </div>
    </div>
  );
}
