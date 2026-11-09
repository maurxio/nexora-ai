import { DEFAULT_NODE_TIMEOUT_MS, MAX_NODE_TIMEOUT_MS, MAX_RETRIES } from '@nexora/shared';
import { executionOrder, shouldRun } from './graph.js';
import * as trigger from './nodes/trigger.js';
import * as transform from './nodes/transform.js';
import * as condition from './nodes/condition.js';
import * as notification from './nodes/notification.js';
import * as http from './nodes/http.js';
import * as approval from './nodes/approval.js';
import * as agent from './nodes/agent.js';

const executors = { trigger, transform, condition, notification, http, approval, agent };
export { resolveTemplates } from './template.js';
export { evaluateCondition } from './condition.js';
export { executionOrder, shouldRun } from './graph.js';

export async function executeNode(node, context, signal, hooks = {}) {
  const executor = executors[node.type];
  const retries = Math.min(MAX_RETRIES, Math.max(0, Number(node.config?.retries || 0)));
  const timeoutMs = Math.min(MAX_NODE_TIMEOUT_MS, Math.max(1, Number(node.config?.timeoutMs || DEFAULT_NODE_TIMEOUT_MS)));
  let attempt = 0;
  while (true) {
    attempt += 1;
    const controller = new AbortController();
    const onAbort = () => controller.abort();
    signal.addEventListener('abort', onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const step = await hooks.onAttempt?.(attempt);
      const output = await executor.execute(node.config || {}, context, { signal: controller.signal });
      await hooks.onSuccess?.(step, output, attempt);
      return { output, attempt };
    } catch (error) {
      await hooks.onFailure?.(error, attempt);
      const retryable = error.retryable === true;
      if (!retryable || attempt > retries || signal.aborted) throw Object.assign(error, { attempt });
      await new Promise((resolve) => setTimeout(resolve, 200 * (2 ** (attempt - 1))));
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
    }
  }
}

export function plan(definition, results) {
  return executionOrder(definition).map((id) => ({ node: definition.nodes.find((node) => node.id === id), run: shouldRun(id, definition, results) }));
}
