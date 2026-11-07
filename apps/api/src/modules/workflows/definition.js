import { z } from 'zod';

const nodeIdSchema = z.string().min(1).max(50).regex(/^[A-Za-z0-9_-]+$/);
const nodeSchema = z.object({
  id: nodeIdSchema,
  type: z.enum(['trigger', 'condition', 'http', 'transform', 'approval', 'notification']),
  config: z.record(z.any()),
}).strict();
const edgeSchema = z.object({
  from: nodeIdSchema,
  to: nodeIdSchema,
  condition: z.enum(['true', 'false']).optional(),
}).strict();

export const shapeSchema = z.object({
  nodes: z.array(nodeSchema).max(100),
  edges: z.array(edgeSchema).max(200),
}).strict();

export function validateGraph(definition) {
  const problems = [];
  const nodes = definition.nodes;
  const edges = definition.edges;
  const nodeIds = new Set(nodes.map((node) => node.id));
  const triggers = nodes.filter((node) => node.type === 'trigger');

  if (triggers.length !== 1) problems.push('Debe existir exactamente un nodo trigger');
  const duplicateIds = nodes
    .map((node) => node.id)
    .filter((id, index, ids) => ids.indexOf(id) !== index);
  if (duplicateIds.length) problems.push('Los ids de nodo deben ser únicos');

  for (const edge of edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) {
      problems.push(`La arista ${edge.from} -> ${edge.to} referencia un nodo inexistente`);
    }
    if (edge.from === edge.to) problems.push(`La arista ${edge.from} -> ${edge.to} no puede apuntar al mismo nodo`);
  }

  const trigger = triggers[0];
  if (trigger) {
    if (edges.some((edge) => edge.to === trigger.id)) {
      problems.push('El trigger no puede tener aristas entrantes');
    }
  }

  const adjacency = new Map(nodes.map((node) => [node.id, []]));
  for (const edge of edges) {
    if (adjacency.has(edge.from) && nodeIds.has(edge.to)) adjacency.get(edge.from).push(edge.to);
    const source = nodes.find((node) => node.id === edge.from);
    if (source?.type === 'condition' && !edge.condition) {
      problems.push(`Las aristas del nodo condition ${edge.from} deben indicar condition true o false`);
    }
    if (source?.type !== 'condition' && edge.condition) {
      problems.push(`La arista ${edge.from} -> ${edge.to} no debe tener condition`);
    }
  }

  const states = new Map();
  let hasCycle = false;
  function visit(id) {
    if (states.get(id) === 'visiting') {
      hasCycle = true;
      return;
    }
    if (states.get(id) === 'visited') return;
    states.set(id, 'visiting');
    for (const next of adjacency.get(id) || []) visit(next);
    states.set(id, 'visited');
  }
  for (const node of nodes) visit(node.id);
  if (hasCycle) problems.push('El grafo no puede contener ciclos');

  if (trigger) {
    const reachable = new Set();
    const pending = [trigger.id];
    while (pending.length) {
      const current = pending.pop();
      if (reachable.has(current)) continue;
      reachable.add(current);
      pending.push(...(adjacency.get(current) || []));
    }
    if (nodes.some((node) => !reachable.has(node.id))) {
      problems.push('Todo nodo debe ser alcanzable desde el trigger');
    }
  }

  return [...new Set(problems)];
}
