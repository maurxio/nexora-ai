import { Router } from 'express';

const router = Router({ mergeParams: true });

router.get('/', (_req, res) => res.status(501).json({ error: 'Pendiente' }));
router.get('/approvals/pending', (_req, res) => res.status(501).json({ error: 'Pendiente' }));
router.post('/approvals/:approvalId/decision', (_req, res) => res.status(501).json({ error: 'Pendiente' }));
router.get('/:id', (_req, res) => res.status(501).json({ error: 'Pendiente' }));
router.get('/:id/steps', (_req, res) => res.status(501).json({ error: 'Pendiente' }));
router.post('/:id/cancel', (_req, res) => res.status(501).json({ error: 'Pendiente' }));
router.post('/:id/retry', (_req, res) => res.status(501).json({ error: 'Pendiente' }));

export default router;
