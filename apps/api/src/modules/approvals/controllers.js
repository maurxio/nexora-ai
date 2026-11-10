import { asyncHandler } from '../../utils.js';
import { approvalListSchema, createApprovalSchema, decisionSchema, notificationListSchema } from './validators.js';
import * as approvalService from './service.js';
import * as notificationService from '../notifications/service.js';

export const createApproval = asyncHandler(async (req, res) => {
  res.status(201).json(await approvalService.createApproval(req.orgId, req.user.id, createApprovalSchema.parse(req.body)));
});

export const listApprovals = asyncHandler(async (req, res) => {
  res.json(await approvalService.listApprovals(req.orgId, approvalListSchema.parse(req.query)));
});

export const getApproval = asyncHandler(async (req, res) => {
  res.json(await approvalService.getApproval(req.orgId, req.params.id));
});

export const approve = asyncHandler(async (req, res) => {
  const input = decisionSchema.parse(req.body);
  res.json(await approvalService.decideApproval(req.orgId, req.user.id, req.params.id, 'APPROVED', input.comment));
});

export const reject = asyncHandler(async (req, res) => {
  const input = decisionSchema.parse(req.body);
  res.json(await approvalService.decideApproval(req.orgId, req.user.id, req.params.id, 'REJECTED', input.comment));
});

export const cancel = asyncHandler(async (req, res) => {
  res.json(await approvalService.cancelApproval(req.orgId, req.user.id, req.role, req.params.id));
});

export const listNotifications = asyncHandler(async (req, res) => {
  res.json(await notificationService.listNotifications(req.orgId, req.user.id, notificationListSchema.parse(req.query)));
});

export const markNotificationRead = asyncHandler(async (req, res) => {
  const result = await notificationService.markRead(req.orgId, req.user.id, req.params.id);
  if (!result.count) return res.status(404).json({ error: 'Notificación no encontrada' });
  res.status(204).send();
});

export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  await notificationService.markAllRead(req.orgId, req.user.id);
  res.status(204).send();
});

export const unreadCount = asyncHandler(async (req, res) => {
  res.json({ count: await notificationService.unreadCount(req.orgId, req.user.id) });
});
