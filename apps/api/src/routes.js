import { Router } from 'express';
import { authenticate } from './middleware/auth.js';
import { tenant } from './middleware/tenant.js';
import auth from './modules/auth/routes.js';
import organizations from './modules/organizations/routes.js';
import agents from './modules/agents/routes.js';
import workflows from './modules/workflows/routes.js';
import executions from './modules/executions/routes.js';
import integrations from './modules/integrations/routes.js';
import documents from './modules/documents/routes.js';
import analytics from './modules/analytics/routes.js';
import approvals from './modules/approvals/routes.js';
import publicWebhooks from './modules/integrations/public-routes.js';

const router = Router();

// Públicas
router.use('/auth', auth);
router.use('/hooks', publicWebhooks);

// Autenticadas
router.use('/organizations', authenticate, organizations);

// Autenticadas y aisladas por organización
const scoped = Router({ mergeParams: true });
scoped.use('/agents', agents);
scoped.use('/workflows', workflows);
scoped.use('/executions', executions);
scoped.use('/integrations', integrations);
scoped.use('/documents', documents);
scoped.use('/analytics', analytics);
scoped.use('/', approvals);
router.use('/orgs/:orgId', authenticate, tenant, scoped);

export default router;
