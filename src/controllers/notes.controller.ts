import type { Request, Response } from 'express';
import { and, asc, eq } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { notes } from '../db/schema.js';
import { createNoteSchema, findNoteSchema, listNotesSchema, updateNoteSchema } from '../schemas/notes.schema.js';
import { HttpError } from '../middleware/errors.js';

function requireNote<T>(note: T | undefined): T {
  if (!note) throw new HttpError(404, 'NOT_FOUND', 'Nota não encontrada.');
  return note;
}

function userId(req: Request): string {
  if (!req.UserId) throw new HttpError(401, 'UNAUTHORIZED', 'Autenticação necessária.');
  return req.UserId;
}

export function notesController(db: Database) {
  return {
    async create(req: Request, res: Response) {
      const { body } = createNoteSchema.parse(req);
      const [note] = await db.insert(notes).values({ ...body, id_user: userId(req) }).returning();
      res.status(201).json(note);
    },
    async list(req: Request, res: Response) {
      listNotesSchema.parse(req);
      res.json(await db.select().from(notes).where(eq(notes.id_user, userId(req))).orderBy(asc(notes.id)));
    },
    async find(req: Request, res: Response) {
      const { params } = findNoteSchema.parse(req);
      const [note] = await db.select().from(notes).where(and(eq(notes.id, params.id), eq(notes.id_user, userId(req))));
      res.json(requireNote(note));
    },
    async update(req: Request, res: Response) {
      const { params, body } = updateNoteSchema.parse(req);
      const [note] = await db.update(notes).set(body).where(and(eq(notes.id, params.id), eq(notes.id_user, userId(req)))).returning();
      res.json(requireNote(note));
    },
    async remove(req: Request, res: Response) {
      const { params } = findNoteSchema.parse(req);
      const [note] = await db.delete(notes).where(and(eq(notes.id, params.id), eq(notes.id_user, userId(req)))).returning({ id: notes.id });
      requireNote(note);
      res.status(204).end();
    },
  };
}
