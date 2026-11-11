import prisma from '../../infrastructure/prisma.js';
import { enqueueEmail, enqueueWorkflowResume } from '../../infrastructure/queue.js';
import { httpError } from '../../utils.js';
import { emitEvent } from '../integrations/service.js';
import { auditService } from '../../infrastructure/audit.js';
import { recordExecutionMetric } from '../../jobs/observability.js';

const assigneeSelect = { id: true, userId: true, decision: true, comment: true, decidedAt: true, user: { select: { id: true, name: true, email: true } } };

async function queueEmails(notifications) {
  await Promise.all(notifications.map((notification) => enqueueEmail({
    to: notification.user.email,
    subject: notification.title,
    text: notification.body,
  })));
}

function notificationBody(status, approval) {
  if (status === 'APPROVED') return `La aprobación "${approval.title}" fue aprobada.`;
  if (status === 'REJECTED') return `La aprobación "${approval.title}" fue rechazada.`;
  return `La aprobación "${approval.title}" expiró.`;
}

export async function createApproval(companyId, requestedById, input) {
  const assigneeIds = [...new Set(input.assigneeIds)];
  const members = await prisma.membership.findMany({ where: { organizationId: companyId, userId: { in: assigneeIds } }, select: { userId: true } });
  if (members.length !== assigneeIds.length) throw httpError(422, 'Todos los asignados deben pertenecer a la organización');
  if (input.workflowRunId) {
    const execution = await prisma.workflowExecution.findFirst({ where: { id: input.workflowRunId, organizationId: companyId }, select: { id: true } });
    if (!execution) throw httpError(404, 'Ejecución no encontrada');
  }
  const approval = await prisma.approval.create({
    data: {
      companyId, requestedById, workflowRunId: input.workflowRunId, title: input.title, description: input.description,
      payload: input.payload, expiresAt: input.expiresAt,
      assignees: { create: assigneeIds.map((userId) => ({ userId })) },
    },
    include: { assignees: { include: { user: { select: { id: true, name: true, email: true } } } } },
  });
  const notifications = await prisma.$transaction(assigneeIds.map((userId) => prisma.notification.create({
    data: {
      companyId, userId, approvalId: approval.id, type: 'APPROVAL_REQUESTED',
      title: 'Nueva aprobación pendiente', body: approval.title, data: { approvalId: approval.id },
    },
    include: { user: { select: { email: true } } },
  })));
  await queueEmails(notifications);
  await emitEvent(companyId, 'approval.created', approval);
  return approval;
}

export function listApprovals(companyId, query) {
  const where = { companyId, ...(query.status ? { status: query.status } : {}) };
  return Promise.all([
    prisma.approval.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (query.page - 1) * query.limit, take: query.limit, include: { assignees: { select: assigneeSelect } } }),
    prisma.approval.count({ where }),
  ]).then(([items, total]) => ({ items, page: query.page, limit: query.limit, total }));
}

export async function getApproval(companyId, id) {
  const approval = await prisma.approval.findFirst({ where: { id, companyId }, include: { assignees: { select: assigneeSelect } } });
  if (!approval) throw httpError(404, 'Aprobación no encontrada');
  return approval;
}

export async function decideApproval(companyId, userId, id, status, comment) {
  const started = Date.now();
  const result = await prisma.$transaction(async (tx) => {
    const approval = await tx.approval.findFirst({ where: { id, companyId }, include: { assignees: true } });
    if (!approval) throw httpError(404, 'Aprobación no encontrada');
    const assignee = approval.assignees.find((item) => item.userId === userId);
    if (!assignee) throw httpError(403, 'No eres asignado de esta aprobación');
    if (approval.status !== 'PENDING') throw httpError(409, 'La aprobación ya fue decidida');
    if (assignee.decision) throw httpError(409, 'Ya decidiste esta aprobación');
    const assigneeUpdate = await tx.approvalAssignee.updateMany({
      where: { id: assignee.id, decision: null, approval: { companyId } },
      data: { decision: status, comment, decidedAt: new Date() },
    });
    if (!assigneeUpdate.count) throw httpError(409, 'La aprobación ya fue decidida');
    const approvalUpdate = await tx.approval.updateMany({ where: { id, companyId, status: 'PENDING' }, data: { status, decidedAt: new Date() } });
    if (!approvalUpdate.count) throw httpError(409, 'La aprobación ya fue decidida');
    const notification = await tx.notification.create({
      data: {
        companyId, userId: approval.requestedById, approvalId: id,
        type: status === 'APPROVED' ? 'APPROVAL_APPROVED' : 'APPROVAL_REJECTED',
        title: status === 'APPROVED' ? 'Aprobación aprobada' : 'Aprobación rechazada',
        body: notificationBody(status, approval), data: { approvalId: id, status },
      },
      include: { user: { select: { email: true } } },
    });
    return { approval, notification };
  });
  await queueEmails([result.notification]);
  await enqueueWorkflowResume({ approvalId: id, status, workflowRunId: result.approval.workflowRunId });
  await emitEvent(companyId, status === 'APPROVED' ? 'approval.approved' : 'approval.rejected', { approvalId: id, status });
  await auditService.record({ tenantId: companyId, actorId: userId, action: `APPROVAL_${status}`, entity: 'Approval', entityId: id, metadata: { status } });
  await recordExecutionMetric({ tenantId: companyId, type: 'APPROVAL', referenceId: id, status: 'SUCCESS', durationMs: Date.now() - started });
  return getApproval(companyId, id);
}

export async function cancelApproval(companyId, userId, role, id) {
  await prisma.$transaction(async (tx) => {
    const approval = await tx.approval.findFirst({ where: { id, companyId } });
    if (!approval) throw httpError(404, 'Aprobación no encontrada');
    if (approval.requestedById !== userId && role !== 'ADMIN') throw httpError(403, 'Permiso denegado');
    const updated = await tx.approval.updateMany({
      where: { id, companyId, status: 'PENDING' },
      data: { status: 'CANCELLED', decidedAt: new Date() },
    });
    if (!updated.count) throw httpError(409, 'La aprobación ya fue decidida');
  });
  return getApproval(companyId, id);
}
