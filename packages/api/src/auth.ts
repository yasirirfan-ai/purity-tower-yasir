import type { Request, Response, NextFunction } from 'express';
import { API_KEY } from './env.js';

/** Optional bearer / x-api-key auth when API_KEY is set. Skips /api/health. */
export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  if (!API_KEY) {
    next();
    return;
  }
  if (req.path === '/api/health') {
    next();
    return;
  }
  const auth = req.headers.authorization;
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  const headerKey = req.headers['x-api-key'];
  const key = typeof headerKey === 'string' ? headerKey : null;
  if (bearer === API_KEY || key === API_KEY) {
    next();
    return;
  }
  res.status(401).json({ error: 'Unauthorized' });
}
