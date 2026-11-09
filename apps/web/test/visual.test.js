import test from 'node:test';
import assert from 'node:assert/strict';
import { definitionToDiagram, diagramToDefinition, newNode, validateDiagram } from '../src/workflows/visual.js';

test('convierte una definición existente a diagrama y de vuelta', () => {
  const definition = { nodes: [{ id: 'trigger-1', type: 'trigger', config: { event: 'manual' } }, { id: 'http-1', type: 'http', config: { url: 'https://example.com' } }], edges: [{ from: 'trigger-1', to: 'http-1' }] };
  const diagram = definitionToDiagram(definition);
  assert.equal(diagram.nodes.length, 2);
  assert.deepEqual(diagramToDefinition(diagram.nodes, diagram.edges).edges, definition.edges);
  assert.equal(diagramToDefinition(diagram.nodes, diagram.edges).nodes[1].config.url, 'https://example.com');
});

test('crea nodos y detecta un workflow inválido', () => {
  const trigger = newNode('trigger');
  trigger.type = 'workflow';
  trigger.data.nodeType = 'trigger';
  const http = newNode('http', 1);
  http.type = 'workflow';
  http.data.nodeType = 'http';
  const problems = validateDiagram([trigger, http], []);
  assert.equal(problems.some((problem) => problem.includes('conectado')), true);
  assert.equal(problems.some((problem) => problem.includes('URL')), true);
});

test('conserva el tipo de cada nodo nuevo', () => {
  assert.equal(newNode('http').data.nodeType, 'http');
  assert.equal(newNode('condition').data.nodeType, 'condition');
});
