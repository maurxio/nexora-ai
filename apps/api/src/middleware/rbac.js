export const requireRole =
  (...roles) =>
  (req, res, next) =>
    req.role === 'OWNER' || roles.includes(req.role)
      ? next()
      : res.status(403).json({ error: 'Permiso denegado' });
