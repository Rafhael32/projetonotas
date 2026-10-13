import express from 'express';
import { fileURLToPath } from 'node:url';
import type { Database } from './db/index.js';
import { mainRoutes } from './routes/main.js';
import { errorHandler, HttpError } from './middleware/errors.js';

export function createApp(db: Database) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, _res, next) => {
    const hasBody = Number(req.headers['content-length'] ?? 0) > 0 || !!req.headers['transfer-encoding'];
    if (hasBody && !req.is('application/json')) {
      next(new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Utilize Content-Type: application/json.'));
      return;
    }
    next();
  });
  app.use(express.json({ limit: '1mb' }));
  app.use(mainRoutes(db));
  app.use(express.static(fileURLToPath(new URL('../public', import.meta.url))));
  app.use((_req, _res, next) => next(new HttpError(404, 'NOT_FOUND', 'Rota não encontrada.')));
  app.use(errorHandler);
  return app;
}
