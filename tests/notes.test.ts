import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { readEnv } from '../src/config/env.js';
import * as schema from '../src/db/schema.js';

test('API com PostgreSQL real em schema isolado', async t => {
  const connectionString = readEnv().DATABASE_URL;
  const admin = new pg.Pool({ connectionString });
  const namespace = 'test_' + randomUUID().replaceAll('-', '');
  let pool: pg.Pool | undefined;
  try {
    await admin.query('CREATE SCHEMA "' + namespace + '"');
    pool = new pg.Pool({ connectionString, options: '-c search_path=' + namespace });
    const db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder: './drizzle', migrationsSchema: namespace });
    const app = createApp(db);
    const token = 'test-session-token';
    const [owner] = await db.insert(schema.users).values({ email: 'notes@example.com', password: 'unused', token }).returning();
    assert.ok(owner);
    const api = request.agent(app).set('Authorization', `Bearer ${token}`);
    let id: number;

    await t.test('todas as rotas de notas exigem um token válido', async () => {
      for (const header of [undefined, 'Basic abc', 'Bearer', 'Bearer abc def', 'Bearer unknown', 'Bearer a,b']) {
        for (const method of ['get', 'post', 'put', 'delete'] as const) {
          const paths = method === 'get' ? ['/notes', '/notes/1'] : [method === 'post' ? '/notes' : '/notes/1'];
          for (const path of paths) {
            const pending = request(app)[method](path);
            if (header) pending.set('Authorization', header);
            const result = await pending.expect(401);
            assert.equal(result.body.error.code, 'UNAUTHORIZED');
          }
        }
      }
      assert.deepEqual(await db.select().from(schema.notes), []);
    });

    await t.test('listagem vazia e CRUD completo com texto preservado', async () => {
      assert.deepEqual((await api.get('/notes').expect(200)).body, []);
      const created = await api.post('/notes').send({ title: '  Compras  ', text: ' café\n pão ' }).expect(201);
      id = created.body.id;
      assert.deepEqual(created.body, { id, id_user: owner.id, title: 'Compras', text: ' café\n pão ' });
      assert.deepEqual((await api.get('/notes/' + id).expect(200)).body, created.body);
      const second = await api.post('/notes').send({ title: 'Outra', text: 'Nota' }).expect(201);
      const all = (await api.get('/notes').expect(200)).body;
      assert.deepEqual(all.map((note: { id: number }) => note.id), [id, second.body.id]);
      const edited = await api.put('/notes/' + id).send({ title: 'Novo', text: 'Atualizado' }).expect(200);
      assert.deepEqual(edited.body, { id, id_user: owner.id, title: 'Novo', text: 'Atualizado' });
      assert.deepEqual((await api.get('/notes/' + id).expect(200)).body, edited.body);
      await api.delete('/notes/' + second.body.id).expect(204).expect('');
    });

    await t.test('validação não altera registros', async () => {
      const before = (await api.get('/notes').expect(200)).body;
      for (const body of [{}, { title: 'X' }, { title: 42, text: 'X' }, { title: ' ', text: 'X' }, { title: 'X', text: ' \n ' }, { title: 'X', text: 'Y', extra: true }]) {
        const result = await api.post('/notes').send(body).expect(400);
        assert.equal(result.body.error.code, 'VALIDATION_ERROR');
      }
      for (const invalidId of ['0', '-1', '1.5', 'abc', '2147483648', '1e2']) {
        await api.get('/notes/' + invalidId).expect(400);
      }
      await api.put('/notes/' + id).send({ title: 'Parcial' }).expect(400);
      await api.get('/notes?page=1').expect(400);
      await api.get('/notes/' + id + '?extra=1').expect(400);
      await api.delete('/notes/' + id + '?extra=1').expect(400);
      await api.get('/notes').send({ extra: true }).expect(400);
      await api.delete('/notes/' + id).send({ extra: true }).expect(400);
      await api.post('/notes').set('Content-Type', 'application/json').send('{"title":').expect(400);
      await api.post('/notes').type('text').send('texto').expect(415);
      await api.post('/notes').send({ title: 'X', text: 'x'.repeat(1024 * 1024) }).expect(413);
      assert.deepEqual((await api.get('/notes').expect(200)).body, before);
    });

    await t.test('exclusão e recurso inexistente', async () => {
      await api.delete('/notes/' + id).expect(204).expect('');
      await api.get('/notes/' + id).expect(404);
      await api.put('/notes/' + id).send({ title: 'X', text: 'Y' }).expect(404);
      await api.delete('/notes/' + id).expect(404);
      await api.get('/inexistente').expect(404);
      assert.deepEqual((await api.get('/notes').expect(200)).body, []);
    });

    await t.test('notas são isoladas por dono e excluídas em cascata', async () => {
      const [other] = await db.insert(schema.users).values({ email: 'other@example.com', password: 'unused', token: 'other-token' }).returning();
      assert.ok(other);
      const otherApi = request.agent(app).set('Authorization', 'Bearer other-token');
      const own = (await api.post('/notes').send({ title: 'Minha', text: 'Privada' }).expect(201)).body;
      const theirs = (await otherApi.post('/notes').send({ title: 'Outra', text: 'Privada' }).expect(201)).body;
      assert.equal(own.id_user, owner.id);
      assert.equal(theirs.id_user, other.id);
      assert.deepEqual((await api.get('/notes').expect(200)).body, [own]);
      assert.deepEqual((await otherApi.get('/notes').expect(200)).body, [theirs]);
      for (const [client, foreign] of [[api, theirs], [otherApi, own]] as const) {
        await client.get('/notes/' + foreign.id).expect(404);
        await client.put('/notes/' + foreign.id).send({ title: 'Invadida', text: 'X' }).expect(404);
        await client.delete('/notes/' + foreign.id).expect(404);
        await client.post('/notes').send({ title: 'X', text: 'Y', id_user: foreign.id_user }).expect(400);
        await client.put('/notes/' + foreign.id).send({ title: 'X', text: 'Y', id_user: owner.id }).expect(400);
      }
      assert.deepEqual((await api.get('/notes/' + own.id).expect(200)).body, own);
      assert.deepEqual((await otherApi.get('/notes/' + theirs.id).expect(200)).body, theirs);
      const [legacy] = await db.insert(schema.notes).values({ title: 'Legada', text: 'Sem dono' }).returning();
      assert.ok(legacy);
      await api.get('/notes/' + legacy.id).expect(404);
      assert.deepEqual((await api.get('/notes').expect(200)).body, [own]);
      await assert.rejects(db.insert(schema.notes).values({ title: 'X', text: 'Y', id_user: randomUUID() }));
      await db.delete(schema.users).where(eq(schema.users.id, other.id));
      assert.deepEqual(await db.select().from(schema.notes).where(eq(schema.notes.id, theirs.id)), []);
      assert.deepEqual((await api.get('/notes/' + own.id).expect(200)).body, own);
      await db.delete(schema.notes).where(eq(schema.notes.id, legacy.id));
    });

    await db.delete(schema.users).where(eq(schema.users.token, token));

    await t.test('cadastro normaliza email, gera UUID e armazena somente hash', async () => {
      const result = await api.post('/auth/register').send({ email: 'User@Example.com', password: '1234' }).expect(201);
      assert.deepEqual(Object.keys(result.body).sort(), ['email', 'id']);
      assert.equal(result.body.email, 'user@example.com');
      assert.match(result.body.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      const [saved] = await db.select().from(schema.users);
      assert.ok(saved);
      assert.equal(saved.id, result.body.id);
      assert.notEqual(saved.password, '1234');
      assert.equal(await bcrypt.compare('1234', saved.password), true);
      assert.equal(await bcrypt.compare('wrong', saved.password), false);
      const duplicate = await api.post('/auth/register').send({ email: 'USER@example.com', password: 'different' }).expect(409);
      assert.equal(duplicate.body.error.code, 'EMAIL_ALREADY_EXISTS');
      assert.deepEqual(await db.select().from(schema.users), [saved]);
    });

    await t.test('cadastro rejeita entradas inválidas sem criar usuários', async () => {
      const before = await db.select().from(schema.users);
      for (const body of [
        {}, { email: 'bad', password: '1234' }, { email: 'a@example.com', password: '123' },
        { email: 12, password: '1234' }, { email: 'a@example.com', password: 1234 },
        { email: 'a@example.com' }, { password: '1234' },
        { email: 'a@example.com', password: '1234', role: 'admin' },
        { email: 'a@example.com', password: 'a'.repeat(73) },
        { email: 'a@example.com', password: 'é'.repeat(37) },
      ]) {
        const result = await api.post('/auth/register').send(body).expect(400);
        assert.equal(result.body.error.code, 'VALIDATION_ERROR');
      }
      await api.post('/auth/register?extra=1').send({ email: 'a@example.com', password: '1234' }).expect(400);
      await api.post('/auth/register').expect(400);
      assert.deepEqual(await db.select().from(schema.users), before);
    });

    await t.test('cadastros simultâneos do mesmo email criam somente um usuário', async () => {
      const results = await Promise.all([
        api.post('/auth/register').send({ email: 'Race@Example.com', password: 'pass1' }),
        api.post('/auth/register').send({ email: 'race@example.com', password: 'pass2' }),
      ]);
      assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
      const saved = (await db.select().from(schema.users)).filter(user => user.email === 'race@example.com');
      assert.equal(saved.length, 1);
    });
    await t.test('login retorna id e token persistido e renova token a cada acesso', async () => {
      const before = (await db.select().from(schema.users)).find(user => user.email === 'user@example.com')!;
      assert.equal(before.token, null);
      const first = await api.post('/auth/login').send({ email: 'USER@Example.com', password: '1234' }).expect(200);
      assert.deepEqual(Object.keys(first.body).sort(), ['id', 'token']);
      assert.equal(first.body.id, before.id);
      assert.match(first.body.token, /^[a-f0-9]{64}$/);
      const saved = (await db.select().from(schema.users)).find(user => user.id === before.id)!;
      assert.equal(saved.token, first.body.token);
      assert.equal(saved.password, before.password);
      const second = await api.post('/auth/login').send({ email: 'user@example.com', password: '1234' }).expect(200);
      assert.notEqual(second.body.token, first.body.token);
      assert.equal(second.body.id, before.id);
      await request(app).get('/notes').set('Authorization', `Bearer ${first.body.token}`).expect(401);
      await request(app).get('/notes').set('Authorization', `Bearer ${second.body.token}`).expect(200);
      assert.equal((await db.select().from(schema.users)).find(user => user.id === before.id)!.token, second.body.token);
    });

    await t.test('email desconhecido e senha incorreta retornam o mesmo erro e preservam token', async () => {
      const before = await db.select().from(schema.users).orderBy(schema.users.id);
      const wrongPassword = await api.post('/auth/login').send({ email: 'user@example.com', password: 'wrong' }).expect(401);
      const unknownEmail = await api.post('/auth/login').send({ email: 'missing@example.com', password: '1234' }).expect(401);
      assert.deepEqual(wrongPassword.body, { error: { code: 'INVALID_CREDENTIALS', message: 'E-mail ou senha inválidos.' } });
      assert.deepEqual(unknownEmail.body, wrongPassword.body);
      assert.deepEqual(await db.select().from(schema.users).orderBy(schema.users.id), before);
    });

    await t.test('login valida body e query sem modificar usuários', async () => {
      const before = await db.select().from(schema.users).orderBy(schema.users.id);
      for (const body of [
        {}, { email: 'bad', password: '1234' }, { email: 'user@example.com', password: '123' },
        { email: 1, password: '1234' }, { email: 'user@example.com', password: 1234 },
        { email: 'user@example.com' }, { password: '1234' },
        { email: 'user@example.com', password: '1234', token: 'forged' },
        { email: 'user@example.com', password: 'x'.repeat(73) },
        { email: 'user@example.com', password: 'é'.repeat(37) },
      ]) {
        const result = await api.post('/auth/login').send(body).expect(400);
        assert.equal(result.body.error.code, 'VALIDATION_ERROR');
      }
      await api.post('/auth/login').expect(400);
      await api.post('/auth/login?extra=1').send({ email: 'user@example.com', password: '1234' }).expect(400);
      await api.post('/auth/login').set('Content-Type', 'application/json').send('{"email":').expect(400);
      assert.deepEqual(await db.select().from(schema.users).orderBy(schema.users.id), before);
    });
    await t.test('falha de banco retorna erro genérico', async () => {
      await pool!.end();
      const result = await api.get('/notes').expect(500);
      assert.deepEqual(result.body, { error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor.' } });
      await api.post('/auth/register').send({ email: 'error@example.com', password: '1234' }).expect(500);
      await api.post('/auth/login').send({ email: 'user@example.com', password: '1234' }).expect(500);
      pool = undefined;
    });
  } finally {
    if (pool) await pool.end();
    await admin.query('DROP SCHEMA IF EXISTS "' + namespace + '" CASCADE');
    await admin.end();
  }
});
