import { Router } from 'express';
import * as controller from './controllers.js';

const router = Router({ mergeParams: true });

router.post('/approvals', controller.createApproval);
router.get('/approvals', controller.listApprovals);
router.get('/approvals/:id', controller.getApproval);
router.post('/approvals/:id/approve', controller.approve);
router.post('/approvals/:id/reject', controller.reject);
router.post('/approvals/:id/cancel', controller.cancel);
router.get('/notifications', controller.listNotifications);
router.patch('/notifications/:id/read', controller.markNotificationRead);
router.post('/notifications/read-all', controller.markAllNotificationsRead);
router.get('/notifications/unread-count', controller.unreadCount);

export default router;
