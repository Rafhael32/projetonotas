import { createApp } from './app.js';
import { readEnv } from './config/env.js';
import { createDatabase } from './db/index.js';

async function main() {
  const env = readEnv();
  const { db, pool } = createDatabase(env.DATABASE_URL);
  try {
    await pool.query('SELECT 1');
    const server = createApp(db).listen(env.PORT, () => {
      console.log('API de notas disponível em http://localhost:' + env.PORT);
    });
    server.on('error', async () => {
      console.error('Não foi possível iniciar o servidor HTTP.');
      await pool.end();
      process.exitCode = 1;
    });
    let closing = false;
    const shutdown = () => {
      if (closing) return;
      closing = true;
      const timeout = setTimeout(() => process.exit(1), 10000);
      timeout.unref();
      server.close(() => {
        void pool.end().finally(() => clearTimeout(timeout));
      });
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch {
    await pool.end();
    throw new Error('Não foi possível conectar ao banco. Verifique o Docker e DATABASE_URL.');
  }
}
main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});