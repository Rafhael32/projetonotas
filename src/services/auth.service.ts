import { eq } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { users } from '../db/schema.js';
import { HttpError } from '../middleware/errors.js';

export function authService(db: Database) {
  return {
    async validateToken(token: string): Promise<string> {
      const [user] = await db.select({ id: users.id }).from(users)
        .where(eq(users.token, token)).limit(1);
      if (!user) throw new HttpError(401, 'UNAUTHORIZED', 'Autenticação necessária.');
      return user.id;
    },
  };
}
