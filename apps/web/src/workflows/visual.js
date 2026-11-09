export const NODE_CATALOG = [
  { type: 'trigger', label: 'Trigger', description: 'Inicia el workflow', category: 'Triggers', color: 'bg-amber-100 text-amber-900', defaults: { event: 'manual' } },
  { type: 'http', label: 'HTTP Request', description: 'Llama a una API externa', category: 'Acciones', color: 'bg-blue-100 text-blue-900', defaults: { method: 'GET', url: '', headers: {}, params: {}, body: '', auth: 'none', timeoutMs: 30000, retries: 0 } },
  { type: 'condition', label: 'Condition', description: 'Divide el flujo en true y false', category: 'Lógica', color: 'bg-violet-100 text-violet-900', defaults: { field: '', operator: 'equals', value: '' } },
  { type: 'transform', label: 'Transform', description: 'Transforma datos del workflow', category: 'Acciones', color: 'bg-cyan-100 text-cyan-900', defaults: { mappings: [{ input: '', output: '', operation: 'copy' }] } },
  { type: 'notification', label: 'Notification', description: 'Envía una notificación', category: 'Acciones', color: 'bg-emerald-100 text-emerald-900', defaults: { channel: 'email', to: '', subject: '', message: '' } },
  { type: 'approval', label: 'Approval', description: 'Espera una aprobación', category: 'Lógica', color: 'bg-orange-100 text-orange-900', defaults: { approver: '', message: '', timeoutMs: 86400000, onApprove: '', onReject: '' } },
  { type: 'agent', label: 'Agent', description: 'Ejecuta un agente de IA', category: 'IA', color: 'bg-fuchsia-100 text-fuchsia-900', defaults: { agentId: '', instructions: '', model: '', tools: [], maxSteps: 10, tokenBudget: 0 } },
];

export const catalogByType = (type) => NODE_CATALOG.find((item) => item.type === type) || NODE_CATALOG[0];

export function newNode(type, index = 0) {
  const item = catalogByType(type);
  return {
    id: `${type}-${Date.now().toString(36)}-${index}`,
    type,
    position: { x: 80 + (index % 4) * 260, y: 80 + Math.floor(index / 4) * 160 },
    data: { label: item.label, nodeType: type, config: structuredClone(item.defaults), state: 'incomplete' },
  };
}

export function definitionToDiagram(definition = {}) {
  const nodes = Array.isArray(definition.nodes) ? definition.nodes : [];
  const edges = Array.isArray(definition.edges) ? definition.edges : [];
  return {
    nodes: nodes.map((node, index) => ({
      id: node.id,
      type: 'workflow',
      position: node.position || { x: 80 + (index % 4) * 260, y: 80 + Math.floor(index / 4) * 160 },
      data: { label: catalogByType(node.type).label, nodeType: node.type, config: node.config || {}, state: 'configured' },
    })),
    edges: edges.map((edge, index) => ({
      id: `edge-${index}-${edge.from}-${edge.to}`,
      source: edge.from,
      target: edge.to,
      sourceHandle: edge.condition || 'default',
      label: edge.condition === 'true' ? 'true' : edge.condition === 'false' ? 'false' : undefined,
      animated: false,
    })),
  };
}

export function diagramToDefinition(nodes, edges) {
  return {
    nodes: nodes.map(({ id, type, data, position }) => ({
      id,
      type: data.nodeType || type,
      config: data.config || {},
      position,
    })),
    edges: edges.map(({ source, target, sourceHandle }) => ({
      from: source,
      to: target,
      ...(sourceHandle && sourceHandle !== 'default' ? { condition: sourceHandle } : {}),
    })),
  };
}

export function validateDiagram(nodes, edges) {
  const problems = [];
  const triggers = nodes.filter((node) => node.data.nodeType === 'trigger');
  if (triggers.length !== 1) problems.push('Debe existir exactamente un nodo trigger.');
  if (nodes.length > 100) problems.push('Se supera el límite de 100 nodos.');
  if (edges.length > 200) problems.push('Se supera el límite de 200 conexiones.');
  const ids = new Set(nodes.map((node) => node.id));
  edges.forEach((edge) => {
    if (!ids.has(edge.source) || !ids.has(edge.target)) problems.push(`La conexión ${edge.source} → ${edge.target} referencia un nodo inexistente.`);
    if (edge.source === edge.target) problems.push('Un nodo no puede conectarse consigo mismo.');
  });
  const incoming = new Set(edges.map((edge) => edge.target));
  if (triggers[0] && edges.some((edge) => edge.target === triggers[0].id)) problems.push('El trigger no puede tener conexiones entrantes.');
  if (triggers[0] && nodes.some((node) => node.id !== triggers[0].id && !incoming.has(node.id))) problems.push('Todo nodo debe estar conectado al flujo.');
  nodes.forEach((node) => {
    const config = node.data.config || {};
    if (node.data.nodeType === 'condition') {
      if (!config.field) problems.push(`${node.data.label}: falta el campo a evaluar.`);
      const outgoing = edges.filter((edge) => edge.source === node.id);
      if (!outgoing.some((edge) => edge.sourceHandle === 'true') || !outgoing.some((edge) => edge.sourceHandle === 'false')) problems.push(`${node.data.label}: debe tener ramas true y false.`);
    }
    if (node.data.nodeType === 'http' && !config.url) problems.push(`${node.data.label}: la URL es obligatoria.`);
    if (node.data.nodeType === 'notification' && (!config.to || !config.message)) problems.push(`${node.data.label}: destinatario y mensaje son obligatorios.`);
    if (node.data.nodeType === 'approval' && (!config.approver || !config.message)) problems.push(`${node.data.label}: aprobador y mensaje son obligatorios.`);
    if (node.data.nodeType === 'agent' && !config.agentId) problems.push(`${node.data.label}: selecciona un agente.`);
  });
  return [...new Set(problems)];
}
