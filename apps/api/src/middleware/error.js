import { ZodError } from 'zod';

export const notFound = (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' });

export const errorHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(422).json({ error: 'Datos inválidos', details: err.flatten() });
  }
  if (err.code === 'P2002') return res.status(409).json({ error: 'El recurso ya existe' });
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({ error: status === 500 ? 'Error interno' : err.message });
};
