import express from 'express';
import { attachDatabasePool } from '@vercel/functions';
import { createApp } from './src/app.js';
import { readEnv } from './src/config/env.js';
import { createDatabase } from './src/db/index.js';

const { db, pool } = createDatabase(readEnv().DATABASE_URL);
attachDatabasePool(pool);
const app = express();
app.disable('x-powered-by');
app.use(createApp(db));

export default app;
