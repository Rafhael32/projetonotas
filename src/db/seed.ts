import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { readEnv } from '../config/env.js';
import { createDatabase } from './index.js';
import { notes, users } from './schema.js';

const { db, pool } = createDatabase(readEnv().DATABASE_URL);
try {
  const ownerId = z.uuid().parse(process.env.SEED_USER_ID);
  await db.transaction(async tx => {
    const [owner] = await tx.select({ id: users.id }).from(users).where(eq(users.id, ownerId));
    if (!owner) throw new Error('Usuário do seed inexistente.');
    await tx.execute(sql`LOCK TABLE notes IN EXCLUSIVE MODE`);
    const existing = await tx.select({ id: notes.id }).from(notes).where(eq(notes.id_user, ownerId)).limit(1);
    if (existing.length) {
      console.log('Seed ignorado: o banco já contém notas.');
      return;
    }
    await tx.insert(notes).values([
      { title: 'Bem-vindo', text: 'Esta é sua primeira nota.' },
      { title: 'Próximos passos', text: 'Crie, consulte, edite e exclua notas pela API.' },
    ].map(note => ({ ...note, id_user: ownerId })));
    console.log('Duas notas de exemplo criadas.');
  });
} catch {
  console.error('Falha ao executar seed. Verifique a conexão, as migrações e SEED_USER_ID (UUID de usuário existente).');
  process.exitCode = 1;
} finally {
  await pool.end();
}
