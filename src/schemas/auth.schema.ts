import { z } from 'zod';

export const registerSchema = z.object({
  body: z.strictObject({
    email: z.string().toLowerCase().pipe(z.email('E-mail inválido.')),
    password: z.string().min(4, 'A senha deve ter no mínimo 4 caracteres.')
      .refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'A senha deve ter no máximo 72 bytes.'),
  }),
  params: z.strictObject({}),
  query: z.strictObject({}),
});

export const loginSchema = registerSchema;
