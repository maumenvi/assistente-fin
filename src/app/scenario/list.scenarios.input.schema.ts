import { z } from 'zod';

/** Schema da entrada de "listar cenarios" (spec 002, RF-35). */
export const listScenariosInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
});

/** Entrada ja validada de `ListScenariosUseCase`. */
export type ListScenariosInput = z.infer<typeof listScenariosInputSchema>;
