import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';
import { readEnv } from './src/config/env.js';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: readEnv().DATABASE_URL },
});