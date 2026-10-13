import { index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core';

export const notes = pgTable('notes', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  title: text('title').notNull(),
  text: text('text').notNull(),
  id_user: uuid('id_user').references(() => users.id, { onDelete: 'cascade' }),
}, table => [index('notes_id_user_idx').on(table.id_user)]);
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  token: text('token'),
});
