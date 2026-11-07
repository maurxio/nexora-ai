import { Router } from 'express';

const router = Router({ mergeParams: true });

router.get('/', (_req, res) => res.status(501).json({ error: 'Pendiente' }));
router.post('/', (_req, res) => res.status(501).json({ error: 'Pendiente' }));
router.get('/:id', (_req, res) => res.status(501).json({ error: 'Pendiente' }));
router.patch('/:id', (_req, res) => res.status(501).json({ error: 'Pendiente' }));
router.delete('/:id', (_req, res) => res.status(501).json({ error: 'Pendiente' }));
router.put('/:id/tools', (_req, res) => res.status(501).json({ error: 'Pendiente' }));
router.post('/:id/run', (_req, res) => res.status(501).json({ error: 'Pendiente' }));

export default router;
