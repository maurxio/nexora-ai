import crypto from 'node:crypto';

export function requestId(req, res, next) {
  const incoming = req.get('x-request-id');
  req.id = incoming && incoming.length <= 128 ? incoming : crypto.randomUUID();
  res.setHeader('x-request-id', req.id);
  next();
}
