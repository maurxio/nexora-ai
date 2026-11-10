import { Queue } from 'bullmq';
import { QUEUE_NAME } from '@nexora/shared';

function connectionFromEnv() {
  const url = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
  };
}

export const workflowQueue = new Queue(QUEUE_NAME, { connection: connectionFromEnv() });
export const approvalQueue = new Queue('approvals', { connection: connectionFromEnv() });
export const workflowResumeQueue = new Queue('workflow-resume', { connection: connectionFromEnv() });
export const emailQueue = new Queue('notification-email', { connection: connectionFromEnv() });
export const webhookInboundQueue = new Queue('webhook-inbound', { connection: connectionFromEnv() });
export const webhookOutboundQueue = new Queue('webhook-outbound', { connection: connectionFromEnv() });
export function enqueueExecution(executionId) {
  return workflowQueue.add('execute', { executionId }, {
    jobId: executionId,
    attempts: 1,
    removeOnComplete: true,
  });
}

export function enqueueWorkflowResume(data) {
  return workflowResumeQueue.add('resume', data, { attempts: 3, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: true });
}

export function enqueueEmail(data) {
  return emailQueue.add('send', data, { attempts: 3, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: true });
}

export function enqueueWebhookInbound(eventId) {
  return webhookInboundQueue.add('process', { eventId }, {
    jobId: `inbound:${eventId}`, attempts: 3, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: true,
  });
}

export function enqueueWebhookOutbound(data) {
  return webhookOutboundQueue.add('deliver', data, {
    jobId: `outbound:${data.subscriptionId}:${Date.now()}:${Math.random()}`,
    attempts: 5, backoff: { type: 'exponential', delay: 1000 }, removeOnComplete: true,
  });
}

export function scheduleApprovalExpiry() {
  return approvalQueue.add('expire', {}, { repeat: { every: 60_000 }, jobId: 'approval-expiry', removeOnComplete: true });
}
