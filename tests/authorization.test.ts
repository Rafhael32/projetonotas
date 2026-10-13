import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import request from 'supertest';
import { authorization } from '../src/middleware/authorization.js';
import { errorHandler } from '../src/middleware/errors.js';

test('middleware valida token pelo serviço e preenche UserId antes do next', async () => {
  const app = express();
  const tokens: string[] = [];
  app.get('/protected', authorization({
    async validateToken(token) {
      tokens.push(token);
      return 'user-id';
    },
  }), (req, res) => res.json({ id: req.UserId }));
  app.use(errorHandler);
  await request(app).get('/protected').expect(401);
  assert.deepEqual(tokens, []);
  const result = await request(app).get('/protected').set('Authorization', 'bearer valid-token').expect(200);
  assert.deepEqual(tokens, ['valid-token']);
  assert.deepEqual(result.body, { id: 'user-id' });
});

test('falha do serviço impede execução do handler', async () => {
  const app = express();
  let called = false;
  app.get('/protected', authorization({
    async validateToken() { throw new Error('database unavailable'); },
  }), (_req, res) => { called = true; res.end(); });
  app.use(errorHandler);
  await request(app).get('/protected').set('Authorization', 'Bearer token').expect(500);
  assert.equal(called, false);
});
