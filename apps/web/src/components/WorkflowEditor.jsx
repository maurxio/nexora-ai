import { useCallback, useMemo, useRef, useState } from 'react';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button, Input } from './Ui.jsx';
import { useTheme } from '../theme/ThemeContext.jsx';
import {
  NODE_CATALOG,
  catalogByType,
  definitionToDiagram,
  diagramToDefinition,
  newNode,
  validateDiagram,
} from '../workflows/visual.js';

function WorkflowNode({ data, selected }) {
  const item = catalogByType(data.nodeType);
  const stateLabel =
    {
      configured: 'Configurado',
      incomplete: 'Incompleto',
      running: 'Ejecutando',
      succeeded: 'Exitoso',
      failed: 'Fallido',
      skipped: 'Omitido',
    }[data.state] || 'Incompleto';
  return (
    <div
      className={`relative min-w-48 rounded-lg border bg-white dark:bg-[var(--surface)] shadow-sm ${selected ? 'border-blue-600 ring-2 ring-blue-200 dark:ring-blue-800' : 'border-slate-200 dark:border-slate-700'}`}
    >
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !bg-slate-500" />
      <div className={`rounded-t-lg px-3 py-2 text-xs font-bold ${item.color}`}>
        <span>{item.label}</span>
        <span className="float-right">{stateLabel}</span>
      </div>
      <div className="px-3 py-3 text-xs text-slate-600 dark:text-slate-300">
        {data.config?.url || data.config?.event || item.description}
      </div>
      {data.nodeType === 'condition' ? (
        <>
          <Handle
            id="true"
            type="source"
            position={Position.Right}
            style={{ top: '35%' }}
            className="!h-3 !w-3 !bg-emerald-600"
          />
          <span className="absolute -right-10 top-[28%] text-[10px] text-emerald-700 dark:text-emerald-300">
            Sí
          </span>
          <Handle
            id="false"
            type="source"
            position={Position.Right}
            style={{ top: '70%' }}
            className="!h-3 !w-3 !bg-red-600"
          />
          <span className="absolute -right-10 top-[63%] text-[10px] text-red-700 dark:text-red-300">
            No
          </span>
        </>
      ) : (
        <Handle
          id="default"
          type="source"
          position={Position.Right}
          className="!h-3 !w-3 !bg-blue-600"
        />
      )}
    </div>
  );
}

const nodeTypes = { workflow: WorkflowNode };
const inputFields = {
  trigger: [['event', 'Evento', 'select']],
  http: [
    ['method', 'Método', 'select'],
    ['url', 'URL'],
    ['timeoutMs', 'Tiempo límite (ms)', 'number'],
    ['retries', 'Reintentos', 'number'],
    ['auth', 'Autenticación', 'select'],
    ['body', 'Cuerpo de la solicitud'],
  ],
  condition: [
    ['field', 'Campo a evaluar'],
    ['operator', 'Operador', 'select'],
    ['value', 'Valor'],
  ],
  notification: [
    ['channel', 'Canal', 'select'],
    ['to', 'Destinatario'],
    ['subject', 'Asunto'],
    ['message', 'Mensaje'],
  ],
  approval: [
    ['approver', 'Usuario o rol aprobador'],
    ['message', 'Mensaje'],
    ['timeoutMs', 'Tiempo límite (ms)', 'number'],
    ['onApprove', 'Acción si aprueba'],
    ['onReject', 'Acción si rechaza'],
  ],
  agent: [
    ['agentId', 'Agente de IA', 'agentSelect'],
    ['instructions', 'Instrucciones adicionales'],
  ],
};

function ConfigPanel({ node, agents, onChange, onDelete, onDuplicate }) {
  if (!node)
    return (
      <aside className="w-full xl:w-72 shrink-0 border-t xl:border-t-0 xl:border-l bg-white dark:bg-[var(--surface)] p-4 text-sm text-slate-500 dark:text-slate-400">
        Selecciona un nodo para configurarlo.
      </aside>
    );
  const fields = inputFields[node.data.nodeType] || [];
  const update = (key, value) =>
    onChange({
      ...node,
      data: {
        ...node.data,
        config: { ...node.data.config, [key]: value },
        state: value ? 'configured' : 'incomplete',
      },
    });
  const options = {
    event: [
      ['manual', 'Manual'],
      ['webhook', 'Webhook'],
      ['schedule', 'Programado'],
      ['integration', 'Otra integración'],
    ],
    method: [
      ['GET', 'GET'],
      ['POST', 'POST'],
      ['PUT', 'PUT'],
      ['PATCH', 'PATCH'],
      ['DELETE', 'DELETE'],
    ],
    auth: [
      ['none', 'Ninguna'],
      ['bearer', 'Bearer'],
      ['basic', 'Basic'],
    ],
    operator: [
      ['equals', 'Igual a'],
      ['notEquals', 'Distinto de'],
      ['contains', 'Contiene'],
      ['exists', 'Existe'],
    ],
    channel: [
      ['email', 'Correo electrónico'],
      ['slack', 'Slack'],
      ['teams', 'Teams'],
      ['webhook', 'Webhook'],
    ],
  };
  const selectedAgent =
    node.data.nodeType === 'agent'
      ? agents.find((agent) => agent.id === node.data.config?.agentId)
      : null;
  return (
    <aside className="w-full xl:w-80 shrink-0 overflow-y-auto border-t xl:border-t-0 xl:border-l bg-white dark:bg-[var(--surface)] p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">{catalogByType(node.data.nodeType).label}</h3>
        <div className="flex gap-2">
          <button className="text-sm text-blue-700 dark:text-blue-300" onClick={onDuplicate}>
            Duplicar
          </button>
          <button className="text-sm text-red-700 dark:text-red-300" onClick={onDelete}>
            Eliminar
          </button>
        </div>
      </div>
      <div className="space-y-3">
        {fields.map(([key, label, kind]) => (
          <label
            key={key}
            className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            {label}
            {kind === 'agentSelect' ? (
              <select
                className="control mt-1 font-normal"
                value={node.data.config?.[key] ?? ''}
                onChange={(e) => update(key, e.target.value)}
              >
                <option value="">Selecciona un agente...</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name}
                  </option>
                ))}
              </select>
            ) : kind === 'select' ? (
              <select
                className="control mt-1 font-normal"
                value={node.data.config?.[key] ?? ''}
                onChange={(e) => update(key, e.target.value)}
              >
                {(options[key] || []).map(([value, name]) => (
                  <option key={value} value={value}>
                    {name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className="control mt-1 font-normal"
                type={kind || 'text'}
                value={node.data.config?.[key] ?? ''}
                onChange={(e) =>
                  update(key, kind === 'number' ? Number(e.target.value) : e.target.value)
                }
              />
            )}
            {['url', 'field', 'value', 'message', 'body', 'instructions'].includes(key) && (
              <>
                <select
                  aria-label={`Insertar variable en ${label}`}
                  className="mt-1 w-full rounded border p-1 text-xs font-normal text-slate-500 dark:text-slate-400"
                  value=""
                  onChange={(e) => {
                    if (e.target.value)
                      update(key, `${node.data.config?.[key] || ''}${e.target.value}`);
                  }}
                >
                  <option value="">Insertar variable...</option>
                  <option value="{{$input.email}}">Entrada: email</option>
                  <option value="{{$input.id}}">Entrada: id</option>
                  <option value="{{$nodes.buscarCliente.output.name}}">
                    Nodo anterior: nombre
                  </option>
                </select>
                <small className="mt-1 block font-normal text-tertiary">
                  Puedes usar {'{{$input.email}}'} o {'{{$nodes.buscar.output.name}}'}
                </small>
              </>
            )}
          </label>
        ))}
      </div>
      {node.data.nodeType === 'agent' && selectedAgent && (
        <div className="mt-4 rounded bg-[var(--surface-muted)] p-3 text-xs text-slate-700 dark:text-slate-200">
          <p className="font-semibold">{selectedAgent.name}</p>
          <p className="mt-1">Modelo: {selectedAgent.model || 'predeterminado'}</p>
          <p>Máximo de pasos: {selectedAgent.maxStepsPerRun}</p>
          <p>Presupuesto mensual: {selectedAgent.monthlyTokenBudget || 'sin límite'}</p>
          <p className="mt-2 whitespace-pre-wrap">{selectedAgent.systemInstructions}</p>
        </div>
      )}
      <div className="mt-4 rounded bg-slate-50 dark:bg-[var(--surface-muted)] p-2 text-xs text-slate-500 dark:text-slate-400">
        La configuración base se administra en Agentes. Aquí solo puedes elegir el agente y añadir
        instrucciones para este nodo.
      </div>
    </aside>
  );
}

export default function WorkflowEditor({
  definition,
  agents = [],
  editable,
  onChange,
  onSave,
  onValidate,
  onTest,
  onPublish,
  sending,
}) {
  const { theme } = useTheme();
  const initial = useMemo(() => definitionToDiagram(definition), [definition]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const history = useRef({ past: [], future: [] });
  const selected = nodes.find((node) => node.id === selectedId);
  const filtered = NODE_CATALOG.filter((item) =>
    `${item.label} ${item.description}`.toLowerCase().includes(search.toLowerCase()),
  );
  const sync = useCallback(
    (nextNodes, nextEdges = edges) => onChange(diagramToDefinition(nextNodes, nextEdges)),
    [edges, onChange],
  );
  const commit = (nextNodes, nextEdges = edges) => {
    history.current.past.push({ nodes, edges });
    history.current.future = [];
    setNodes(nextNodes);
    setEdges(nextEdges);
    sync(nextNodes, nextEdges);
  };
  const connect = useCallback(
    (connection) => {
      const next = addEdge(
        {
          ...connection,
          type: 'smoothstep',
          animated: false,
          label:
            connection.sourceHandle === 'true'
              ? 'Sí'
              : connection.sourceHandle === 'false'
                ? 'No'
                : undefined,
        },
        edges,
      );
      setEdges(next);
      sync(nodes, next);
    },
    [edges, nodes, setEdges, sync],
  );
  const updateSelected = (node) => {
    const next = nodes.map((item) => (item.id === node.id ? node : item));
    commit(next);
  };
  const add = (type) => {
    const node = newNode(type, nodes.length);
    node.type = 'workflow';
    commit([...nodes, node]);
    setSelectedId(node.id);
  };
  const remove = () => {
    if (!selected || !window.confirm(`¿Eliminar ${selected.data.label}?`)) return;
    const nextNodes = nodes.filter((node) => node.id !== selected.id);
    const nextEdges = edges.filter(
      (edge) => edge.source !== selected.id && edge.target !== selected.id,
    );
    commit(nextNodes, nextEdges);
    setSelectedId(null);
  };
  const duplicate = () => {
    if (!selected) return;
    const copy = {
      ...selected,
      id: `${selected.id}-copy-${Date.now().toString(36)}`,
      position: { x: selected.position.x + 40, y: selected.position.y + 40 },
      data: { ...selected.data, config: structuredClone(selected.data.config) },
    };
    commit([...nodes, copy]);
    setSelectedId(copy.id);
  };
  const undo = () => {
    const previous = history.current.past.pop();
    if (!previous) return;
    history.current.future.push({ nodes, edges });
    setNodes(previous.nodes);
    setEdges(previous.edges);
    sync(previous.nodes, previous.edges);
  };
  const redo = () => {
    const next = history.current.future.pop();
    if (!next) return;
    history.current.past.push({ nodes, edges });
    setNodes(next.nodes);
    setEdges(next.edges);
    sync(next.nodes, next.edges);
  };
  const handleNodesChange = (changes) => {
    const nextNodes = applyNodeChanges(changes, nodes);
    setNodes(nextNodes);
    if (
      changes.some(
        (change) =>
          change.type === 'remove' || (change.type === 'position' && change.dragging === false),
      )
    )
      sync(nextNodes, edges);
  };
  const handleEdgesChange = (changes) => {
    const nextEdges = applyEdgeChanges(changes, edges);
    setEdges(nextEdges);
    if (changes.some((change) => change.type === 'remove')) sync(nodes, nextEdges);
  };
  const validate = () => onValidate(validateDiagram(nodes, edges));
  return (
    <div className="overflow-hidden rounded-lg border bg-slate-50 dark:bg-[var(--surface-muted)] shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b bg-white dark:bg-[var(--surface)] p-3">
        <Button
          disabled={!editable || sending}
          onClick={() => onSave(diagramToDefinition(nodes, edges))}
        >
          Guardar borrador
        </Button>
        <button
          className="rounded border px-3 py-2 text-sm"
          disabled={!editable || !history.current.past.length}
          onClick={undo}
        >
          Deshacer
        </button>
        <button
          className="rounded border px-3 py-2 text-sm"
          disabled={!editable || !history.current.future.length}
          onClick={redo}
        >
          Rehacer
        </button>
        <Button disabled={sending} variant="secondary" onClick={validate}>
          Validar workflow
        </Button>
        <Button disabled={!editable || sending} variant="secondary" onClick={onTest}>
          Probar workflow
        </Button>
        <Button disabled={!editable || sending} variant="secondary" onClick={onPublish}>
          Publicar
        </Button>
      </div>
      <div className="flex min-h-[680px] flex-col xl:h-[680px] xl:flex-row">
        <aside className="w-full xl:w-56 max-h-64 xl:max-h-none shrink-0 overflow-y-auto border-b xl:border-b-0 xl:border-r bg-white dark:bg-[var(--surface)] p-3">
          <h3 className="mb-2 font-semibold">Paleta de nodos</h3>
          <Input
            label="Buscar nodos"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {filtered.map((item) => (
            <button
              key={item.type}
              draggable
              onDragStart={(event) =>
                event.dataTransfer.setData('application/workflow-node', item.type)
              }
              onClick={() => editable && add(item.type)}
              className="mt-2 w-full rounded-lg border bg-white dark:bg-[var(--surface)] p-2 text-left hover:border-blue-500 disabled:opacity-50"
              disabled={!editable}
            >
              <div
                className={`mb-1 inline-block rounded px-2 py-1 text-xs font-semibold ${item.color}`}
              >
                {item.label}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">{item.description}</div>
            </button>
          ))}
        </aside>
        <div
          className="min-h-[440px] min-w-0 flex-1"
          onDrop={(event) => {
            event.preventDefault();
            const type = event.dataTransfer.getData('application/workflow-node');
            if (type) add(type);
          }}
          onDragOver={(event) => event.preventDefault()}
        >
          <ReactFlow
            colorMode={theme}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={connect}
            onNodeClick={(_, node) => setSelectedId(node.id)}
            onPaneClick={() => setSelectedId(null)}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background gap={20} />
            <Controls aria-label="Controles del diagrama" />
            <MiniMap />
          </ReactFlow>
        </div>
        <ConfigPanel
          node={selected}
          agents={agents}
          onChange={updateSelected}
          onDelete={remove}
          onDuplicate={duplicate}
        />
      </div>
    </div>
  );
}
