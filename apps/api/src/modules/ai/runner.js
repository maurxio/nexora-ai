import prisma from '../../infrastructure/prisma.js';
import { resolveProvider } from './service.js';
import { aiCallCounter, aiTokens, aiLatency } from '../../infrastructure/metrics.js';

export async function executeAgent({ orgId, runId, config, context, signal }) {
  const { config: providerConfig, provider } = await resolveProvider(orgId, config.providerConfigId);
  const monthStart = new Date();
  monthStart.setUTCDate(1); monthStart.setUTCHours(0, 0, 0, 0);
  const usage = await prisma.aiUsage.aggregate({
    where: { configId: providerConfig.id, createdAt: { gte: monthStart }, status: 'SUCCESS' },
    _sum: { inputTokens: true, outputTokens: true },
  });
  const used = (usage._sum.inputTokens || 0) + (usage._sum.outputTokens || 0);
  if (providerConfig.monthlyTokenLimit && used >= providerConfig.monthlyTokenLimit) {
    const error = new Error('Se excedió el límite mensual de tokens'); error.code = 'AI_LIMIT_EXCEEDED'; throw error;
  }
  const messages = [
    ...(config.systemInstructions ? [{ role: 'system', content: config.systemInstructions }] : []),
    { role: 'user', content: config.prompt || JSON.stringify(context.input ?? context) },
  ];
  const maxIterations = Math.min(Number(config.maxIterations || 5), 20);
  let result;
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const started = Date.now();
    try {
      result = await provider.generate({ messages, tools: config.tools || [], responseSchema: config.responseSchema, signal });
      const total = (result.usage.inputTokens || 0) + (result.usage.outputTokens || 0);
      if (providerConfig.monthlyTokenLimit && used + total > providerConfig.monthlyTokenLimit) {
        await prisma.aiUsage.create({ data: { orgId, runId, configId: providerConfig.id, inputTokens: result.usage.inputTokens || 0, outputTokens: result.usage.outputTokens || 0, latencyMs: Date.now() - started, status: 'LIMIT_EXCEEDED' } });
        const error = new Error('Se excedió el límite mensual de tokens'); error.code = 'AI_LIMIT_EXCEEDED'; throw error;
      }
      await prisma.aiUsage.create({ data: { orgId, runId, configId: providerConfig.id, inputTokens: result.usage.inputTokens || 0, outputTokens: result.usage.outputTokens || 0, latencyMs: Date.now() - started, status: 'SUCCESS' } });
      aiTokens.labels(providerConfig.provider, 'input').inc(result.usage.inputTokens || 0);
      aiTokens.labels(providerConfig.provider, 'output').inc(result.usage.outputTokens || 0);
      aiLatency.labels(providerConfig.provider).observe((Date.now() - started) / 1000);
      aiCallCounter.labels(providerConfig.provider, 'success').inc();
      if (!result.toolCalls?.length) return result.text;
      const sensitive = result.toolCalls.find((call) => call.sensitive || config.sensitiveTools?.includes(call.name || call.function?.name));
      if (sensitive) {
        const error = new Error('Ejecución en espera de aprobación humana'); error.code = 'AI_APPROVAL_REQUIRED'; error.toolCall = sensitive; throw error;
      }
      messages.push({ role: 'assistant', content: result.text || '', tool_calls: result.toolCalls });
    } catch (error) {
      if (!error.code) {
        await prisma.aiUsage.create({ data: { orgId, runId, configId: providerConfig.id, inputTokens: 0, outputTokens: 0, latencyMs: Date.now() - started, status: error.name === 'TimeoutError' ? 'TIMEOUT' : 'ERROR' } }).catch(() => {});
        aiCallCounter.labels(providerConfig.provider, error.name === 'TimeoutError' ? 'timeout' : 'error').inc();
      }
      throw error;
    }
  }
  throw new Error('El agente excedió el máximo de iteraciones');
}
