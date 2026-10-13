import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  PORT: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1).max(65535)),
  DATABASE_URL: z.url().refine(value => /^postgres(ql)?:\/\//.test(value)),
});

export function readEnv() {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map(issue => issue.path.join('.')))];
    throw new Error('Configuração inválida: verifique ' + fields.join(', ') + ' no .env.');
  }
  return result.data;
}