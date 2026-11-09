import { evaluateCondition } from '../condition.js';
export async function execute(config, context) {
  return { result: evaluateCondition(config.expression ?? config.condition, context) };
}
