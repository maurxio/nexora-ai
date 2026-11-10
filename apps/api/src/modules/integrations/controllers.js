import { asyncHandler } from '../../utils.js';
import * as service from './service.js';
import * as schemas from './validators.js';

export const createConnector = asyncHandler(async (req, res) => res.status(201).json(await service.createConnector(req.orgId, req.user.id, schemas.connectorSchema.parse(req.body))));
export const listConnectors = asyncHandler(async (req, res) => res.json(await service.listConnectors(req.orgId)));
export const getConnector = asyncHandler(async (req, res) => res.json(await service.getConnector(req.orgId, req.params.id)));
export const updateConnector = asyncHandler(async (req, res) => res.json(await service.updateConnector(req.orgId, req.params.id, schemas.connectorPatchSchema.parse(req.body))));
export const deleteConnector = asyncHandler(async (req, res) => { await service.deleteConnector(req.orgId, req.params.id); res.status(204).send(); });
export const testConnector = asyncHandler(async (req, res) => {
  const connector = await service.getConnector(req.orgId, req.params.id);
  const input = schemas.testSchema.parse(req.body || {});
  res.json(await service.executeHttpRequest({ companyId: req.orgId, connectorId: connector.id, method: input.method, url: input.path, body: input.body }));
});
export const createEndpoint = asyncHandler(async (req, res) => res.status(201).json(await service.createEndpoint(req.orgId, schemas.endpointSchema.parse(req.body))));
export const listEndpoints = asyncHandler(async (req, res) => res.json(await service.listEndpoints(req.orgId)));
export const updateEndpoint = asyncHandler(async (req, res) => res.json(await service.updateEndpoint(req.orgId, req.params.id, schemas.endpointPatchSchema.parse(req.body))));
export const deleteEndpoint = asyncHandler(async (req, res) => { await service.deleteEndpoint(req.orgId, req.params.id); res.status(204).send(); });
export const rotateEndpointSecret = asyncHandler(async (req, res) => res.json(await service.rotateEndpointSecret(req.orgId, req.params.id)));
export const listEvents = asyncHandler(async (req, res) => res.json(await service.listEvents(req.orgId, req.params.id, schemas.eventListSchema.parse(req.query))));
export const createSubscription = asyncHandler(async (req, res) => res.status(201).json(await service.createSubscription(req.orgId, schemas.subscriptionSchema.parse(req.body))));
export const listSubscriptions = asyncHandler(async (req, res) => res.json(await service.listSubscriptions(req.orgId)));
export const updateSubscription = asyncHandler(async (req, res) => res.json(await service.updateSubscription(req.orgId, req.params.id, schemas.subscriptionPatchSchema.parse(req.body))));
export const deleteSubscription = asyncHandler(async (req, res) => { await service.deleteSubscription(req.orgId, req.params.id); res.status(204).send(); });
export const listLogs = asyncHandler(async (req, res) => res.json(await service.listLogs(req.orgId, schemas.logListSchema.parse(req.query))));
export const receiveWebhook = asyncHandler(async (req, res) => { await service.receiveWebhook(req.params.slug, req.rawBody || '', req.headers); res.status(202).json({ accepted: true }); });
