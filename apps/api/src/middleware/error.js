import { ZodError } from 'zod';
import { logger } from '../infrastructure/logger.js';

export const notFound = (_req, res) => res.status(404).json({ error: 'Ruta no encontrada' });

export const errorHandler = (err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'El archivo excede el tamaño máximo permitido' });
  if (err instanceof ZodError) {
    return res.status(422).json({ error: 'Datos inválidos', details: err.flatten() });
  }
  if (err.code === 'P2002') return res.status(409).json({ error: 'El recurso ya existe' });
  const status = err.status || 500;
  if (status === 500) logger.error({ err }, 'request failed');
  res.status(status).json({ error: status === 500 ? 'Error interno' : err.message });
};
