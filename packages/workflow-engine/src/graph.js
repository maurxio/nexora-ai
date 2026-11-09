export function executionOrder(definition) {
  const incoming = new Map(definition.nodes.map((node) => [node.id, 0]));
  for (const edge of definition.edges) incoming.set(edge.to, incoming.get(edge.to) + 1);
  const queue = definition.nodes.filter((node) => incoming.get(node.id) === 0).map((node) => node.id);
  const order = [];
  while (queue.length) {
    const id = queue.shift();
    order.push(id);
    for (const edge of definition.edges.filter((item) => item.from === id)) {
      incoming.set(edge.to, incoming.get(edge.to) - 1);
      if (incoming.get(edge.to) === 0) queue.push(edge.to);
    }
  }
  return order;
}

export function isEdgeActive(edge, results) {
  const source = results[edge.from];
  if (!source || source.status !== 'SUCCEEDED') return false;
  if (!edge.condition) return true;
  return Boolean(source.output?.result) === (edge.condition === 'true');
}

export function shouldRun(nodeId, definition, results) {
  const node = definition.nodes.find((item) => item.id === nodeId);
  return node?.type === 'trigger' || definition.edges.some((edge) => edge.to === nodeId && isEdgeActive(edge, results));
}
