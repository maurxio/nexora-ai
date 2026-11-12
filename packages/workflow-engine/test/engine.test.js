import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveTemplates, evaluateCondition, executionOrder, shouldRun } from '../src/index.js';
import { execute as executeHttp } from '../src/nodes/http.js';

const context = { input: { total: 10, name: 'Nora' }, nodes: { check: { result: true } } };

test('resuelve plantillas conservando tipos e interpolando texto', () => {
  assert.equal(resolveTemplates('{{input.total}}', context), 10);
  assert.equal(resolveTemplates('Hola {{input.name}}', context), 'Hola Nora');
  assert.equal(resolveTemplates('{{input.missing}}', context), undefined);
  assert.equal(resolveTemplates('x={{input.missing}}', context), 'x=');
});

test('evalúa operadores y rechaza expresiones inválidas', () => {
  for (const [operator, expected] of [
    ['>', true],
    ['>=', true],
    ['<', false],
    ['<=', false],
    ['==', false],
    ['!=', true],
  ]) {
    assert.equal(evaluateCondition(`input.total ${operator} 5`, context), expected);
  }
  assert.throws(() => evaluateCondition('input.total ??? 5', context), /no es válida/);
});

test('calcula ramas y nodos omitidos', () => {
  const definition = {
    nodes: [
      { id: 'trigger', type: 'trigger' },
      { id: 'check', type: 'condition' },
      { id: 'yes', type: 'transform' },
      { id: 'no', type: 'transform' },
      { id: 'both', type: 'transform' },
    ],
    edges: [
      { from: 'trigger', to: 'check' },
      { from: 'check', to: 'yes', condition: 'true' },
      { from: 'check', to: 'no', condition: 'false' },
      { from: 'yes', to: 'both' },
      { from: 'no', to: 'both' },
    ],
  };
  assert.deepEqual(executionOrder(definition), ['trigger', 'check', 'yes', 'no', 'both']);
  const results = {
    trigger: { status: 'SUCCEEDED' },
    check: { status: 'SUCCEEDED', output: { result: true } },
    yes: { status: 'SUCCEEDED' },
  };
  assert.equal(shouldRun('yes', definition, results), true);
  assert.equal(shouldRun('no', definition, results), false);
  assert.equal(shouldRun('both', definition, results), true);
});

test('bloquea destinos SSRF', async () => {
  for (const url of ['http://169.254.169.254', 'http://10.0.0.1', 'http://127.0.0.1']) {
    await assert.rejects(
      () => executeHttp({ url }, context, { signal: new AbortController().signal }),
      /Destino bloqueado/,
    );
  }
});

test('executes deterministic nodes, reports attempts, propagates cancellation and failures', async () => {
  const { executeNode, plan } = await import('../src/index.js');
  const signal = new AbortController().signal;
  const context = { input: { value: 7 }, nodes: {} };
  let succeeded = 0;
  const result = await executeNode(
    { id: 't', type: 'transform', config: { set: { result: '{{input.value}}' } } },
    context,
    signal,
    {
      onAttempt: () => 'step',
      onSuccess: (step) => {
        assert.equal(step, 'step');
        succeeded++;
      },
    },
  );
  assert.equal(succeeded, 1);
  assert.deepEqual(result.output, { result: 7 });
  assert.equal((await executeNode({ type: 'trigger' }, context, signal)).output.value, 7);
  assert.equal((await executeNode({ type: 'agent' }, context, signal)).output.simulated, true);
  assert.equal(
    (await executeNode({ type: 'notification', config: { message: 'hello' } }, context, signal))
      .output.message,
    'hello',
  );
  await assert.rejects(
    () => executeNode({ type: 'approval' }, context, signal),
    /no están soportados/,
  );
  await assert.rejects(
    () => executeNode({ type: 'transform', config: { simulateDelayMs: -1 } }, context, signal),
    /no es válido/,
  );
  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(
    () => executeNode({ type: 'transform' }, context, cancelled.signal),
    /cancelada/,
  );
  assert.equal(plan({ nodes: [{ id: 't', type: 'trigger' }], edges: [] }, {}).length, 1);
});
