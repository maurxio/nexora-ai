export const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.role) ? next() : res.status(403).json({ error: 'Permiso denegado' });
