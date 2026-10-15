import { z } from 'zod';

/** Entrada de "aprovar pre-registro" (spec 022, FR-024/FR-025/FR-027). */
export const approvePreRegistrationInputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  id: z.string().trim().min(1, 'id obrigatorio'),
  /** Aprovar mesmo marcado como possivel duplicata. */
  confirmDuplicate: z.boolean().optional(),
  /** Nome do celular pareado que aprova (vai para a observacao, G1). */
  approvingDevice: z.string().trim().min(1).max(60).optional(),
});

export type ApprovePreRegistrationInput = z.infer<typeof approvePreRegistrationInputSchema>;
