import { randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { users } from '../db/schema.js';
import { HttpError } from '../middleware/errors.js';
import { registerSchema, loginSchema } from '../schemas/auth.schema.js';

export function authController(db: Database) {
  return {
    async register(req: Request, res: Response) {
      const { body } = registerSchema.parse(req);
      const duplicate = () => new HttpError(409, 'EMAIL_ALREADY_EXISTS', 'E-mail já cadastrado.');
      const [existing] = await db.select({ id: users.id }).from(users)
        .where(eq(users.email, body.email)).limit(1);
      if (existing) throw duplicate();

      const password = await bcrypt.hash(body.password, 12);
      const [user] = await db.insert(users).values({ email: body.email, password })
        .onConflictDoNothing({ target: users.email })
        .returning({ id: users.id, email: users.email });
      if (!user) throw duplicate();
      res.status(201).json(user);
    },
    async login(req: Request, res: Response) {
      const { body } = loginSchema.parse(req);
      const invalidCredentials = () => new HttpError(401, 'INVALID_CREDENTIALS', 'E-mail ou senha inválidos.');
      const [user] = await db.select().from(users).where(eq(users.email, body.email)).limit(1);
      if (!user || !(await bcrypt.compare(body.password, user.password))) {
        throw invalidCredentials();
      }

      const token = randomBytes(32).toString('hex');
      const [session] = await db.update(users).set({ token }).where(eq(users.id, user.id))
        .returning({ id: users.id, token: users.token });
      if (!session) throw invalidCredentials();
      res.status(200).json(session);
    },
  };
}