import { Router } from 'express';
import { receiveWebhook } from './controllers.js';

const router = Router();
router.post('/:slug', receiveWebhook);
export default router;
