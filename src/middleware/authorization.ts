import type { RequestHandler } from 'express';
import type { authService } from '../services/auth.service.js';
import { HttpError } from './errors.js';

declare global {
  namespace Express {
    interface Request {
      UserId?: string;
    }
  }
}

export function authorization(auth: ReturnType<typeof authService>): RequestHandler {
  return async (req, _res, next) => {
    const header = req.get('authorization') ?? '';
    let token = header.slice(7);
    while (token.startsWith(' ')) token = token.slice(1);
    const invalidToken = !token || Array.from(token).some(char => char.trim() === '' || char === ',');
    if (header.slice(0, 7).toLowerCase() !== 'bearer ' || invalidToken) {
      throw new HttpError(401, 'UNAUTHORIZED', 'Autenticação necessária.');
    }
    req.UserId = await auth.validateToken(token);
    next();
  };
}
