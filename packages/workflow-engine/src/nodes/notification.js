import { resolveTemplates } from '../template.js';
export async function execute(config, context) {
  return { simulated: true, message: resolveTemplates(config.message, context) };
}
