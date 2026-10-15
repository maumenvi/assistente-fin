import { z } from 'zod';

/** Schema das entradas que identificam um snapshot do usuario (restore / export / delete). */
export const snapshotIdInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  snapshotId: z.string().trim().min(1, 'snapshotId obrigatorio'),
});

/** Entrada ja validada de casos de uso que so precisam de `userId` + `snapshotId`. */
export type SnapshotIdInput = z.infer<typeof snapshotIdInputSchema>;
