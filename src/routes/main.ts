import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import type { Database } from '../db/index.js';
import { notesController } from '../controllers/notes.controller.js';
import { authorization } from '../middleware/authorization.js';
import { authService } from '../services/auth.service.js';

export function mainRoutes(db: Database) {
  const router = Router();
  const controller = notesController(db);
  const auth = authController(db);
  router.post('/auth/register', auth.register);
  router.post('/auth/login', auth.login);
  router.use('/notes', authorization(authService(db)));
  router.post('/notes', controller.create);
  router.get('/notes', controller.list);
  router.get('/notes/:id', controller.find);
  router.put('/notes/:id', controller.update);
  router.delete('/notes/:id', controller.remove);
  return router;
}
