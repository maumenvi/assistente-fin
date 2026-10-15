import { z } from 'zod';

const decisionSchema = z.enum(['keep-current', 'replace', 'keep-both']);

/** Entrada comum ao plano e a aplicacao: o conteudo do arquivo ja lido (NDJSON -> objetos). */
export const planImportInputSchema = z.object({
  userId: z.string().trim().min(1),
  records: z.array(z.unknown()).min(1, 'arquivo vazio'),
  /** Backup de outro aparelho (spec 022, FR-007). */
  adoptForeignBackup: z.boolean().optional(),
});

/** Aplicacao: + decisao por conflito (`kind:id`) e a de "aplicar a todos os restantes". */
export const applyImportInputSchema = planImportInputSchema.extend({
  decisions: z.record(z.string(), decisionSchema).default({}),
  defaultDecision: decisionSchema.optional(),
});
