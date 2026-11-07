import { Router } from 'express';

const router = Router({ mergeParams: true });

router.get('/overview', (_req, res) => res.status(501).json({ error: 'Pendiente' }));
router.get('/usage', (_req, res) => res.status(501).json({ error: 'Pendiente' }));

export default router;
