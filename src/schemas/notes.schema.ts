import { z } from 'zod';

const empty = z.strictObject({});
const noBody = empty.optional();
export const noteBody = z.strictObject({
  title: z.string().trim().min(1, 'O título é obrigatório.'),
  text: z.string().refine(value => value.trim().length > 0, 'O texto é obrigatório.'),
});
const idParams = z.strictObject({
  id: z.string().regex(/^[1-9]\d*$/, 'Identificador inválido.')
    .transform(Number).pipe(z.number().int().min(1).max(2147483647)),
});
export const listNotesSchema = z.object({ body: noBody, params: empty, query: empty });
export const createNoteSchema = z.object({ body: noteBody, params: empty, query: empty });
export const findNoteSchema = z.object({ body: noBody, params: idParams, query: empty });
export const updateNoteSchema = z.object({ body: noteBody, params: idParams, query: empty });