import { resolveTemplates } from '../template.js';

export async function execute(config, context) {
  return {
    agentId: config.agentId,
    model: config.model || 'default',
    instructions: resolveTemplates(config.instructions || '', context),
    simulated: true,
    output: context.input,
  };
}
