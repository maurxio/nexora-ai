import prisma from '../infrastructure/prisma.js';
import { enqueueEmail } from '../infrastructure/queue.js';
import { deliverWebhook } from '../modules/integrations/service.js';
import { emitEvent } from '../modules/integrations/service.js';
import { recordExecutionMetric } from './observability.js';

export async function expireApprovals() {
  const candidates = await prisma.approval.findMany({
    where: { status: 'PENDING', expiresAt: { lte: new Date() } },
    select: { id: true, companyId: true, requestedById: true, title: true, requestedBy: { select: { email: true } } },
  });
  for (const approval of candidates) {
    const expired = await prisma.$transaction(async (tx) => {
      const result = await tx.approval.updateMany({ where: { id: approval.id, companyId: approval.companyId, status: 'PENDING' }, data: { status: 'EXPIRED', decidedAt: new Date() } });
      if (!result.count) return null;
      return tx.notification.create({
        data: {
          companyId: approval.companyId, userId: approval.requestedById, approvalId: approval.id,
          type: 'APPROVAL_EXPIRED', title: 'Aprobación expirada', body: `La aprobación "${approval.title}" expiró.`,
          data: { approvalId: approval.id, status: 'EXPIRED' },
        },
      });
    });
    if (expired) {
      await enqueueEmail({ to: approval.requestedBy.email, subject: expired.title, text: expired.body });
      await emitEvent(approval.companyId, 'approval.expired', { approvalId: approval.id, status: 'EXPIRED' });
    }
  }
}

export function resumeWorkflow(job) {
  console.log('[workflow-resume:stub]', job.data);
}

export async function processInboundWebhook(job) {
  const started = Date.now();
  const event = await prisma.webhookEvent.findUnique({ where: { id: job.data.eventId }, select: { companyId: true } });
  await prisma.webhookEvent.updateMany({ where: { id: job.data.eventId, status: 'RECEIVED' }, data: { status: 'PROCESSED' } });
  if (event) await recordExecutionMetric({ tenantId: event.companyId, type: 'INTEGRATION', referenceId: job.data.eventId, status: 'SUCCESS', durationMs: Date.now() - started });
}

export async function processOutboundWebhook(job) {
  const started = Date.now();
  try {
    const result = await deliverWebhook(job);
    if (job.data.companyId) await recordExecutionMetric({ tenantId: job.data.companyId, type: 'INTEGRATION', referenceId: job.data.subscriptionId, status: 'SUCCESS', durationMs: Date.now() - started });
    return result;
  } catch (error) {
    if (job.data.companyId) await recordExecutionMetric({ tenantId: job.data.companyId, type: 'INTEGRATION', referenceId: job.data.subscriptionId, status: 'ERROR', durationMs: Date.now() - started, errorCode: error.code || error.name || 'WEBHOOK_ERROR' });
    throw error;
  }
}
