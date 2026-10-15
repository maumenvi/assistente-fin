import { z } from 'zod';
import { AGENT_FORMAT_VERSION } from './format.version.ts';

const cell = z.union([z.string(), z.number(), z.boolean(), z.null()]);

/**
 * Esquema do conteudo entregue ao agente (spec 029, contracts/agent.payload.format.md). O app o
 * gera; o esquema existe para o teste do contrato e para o conteudo que o agente nos devolve
 * (ex.: `snapshotId`) sempre apontar para uma copia valida.
 */
export const agentPayloadSchema = z.object({
  format: z.literal('finctrl-payload'),
  version: z.literal(AGENT_FORMAT_VERSION),
  snapshot: z.object({ id: z.string().min(1), at: z.iso.datetime({ offset: true }) }),
  part: z.object({ index: z.int().min(1), count: z.int().min(1) }).optional(),
  scope: z.object({
    from: z.iso.date().nullable(),
    to: z.iso.date().nullable(),
    accounts: z.union([z.literal('all'), z.array(z.string())]),
    approx: z.boolean(),
    descriptionsOmitted: z.boolean(),
  }),
  catalog: z
    .object({
      accounts: z.array(z.object({ id: z.string(), name: z.string(), kind: z.string(), archived: z.boolean() }).passthrough()),
      categories: z.array(z.object({ id: z.string(), name: z.string(), isDefault: z.boolean() })),
      limits: z.array(z.object({ id: z.string(), categoryId: z.string(), year: z.int(), month: z.int(), maxAmountCents: z.int() }).passthrough()),
      fixedExpenses: z.array(z.object({ id: z.string(), dueDay: z.int(), expectedAmountCents: z.int(), paid: z.boolean() }).passthrough()),
      incomes: z.array(z.object({ id: z.string(), source: z.string(), amountCents: z.int() }).passthrough()),
    })
    .optional(),
  transactions: z.object({ cols: z.array(z.string()), rows: z.array(z.array(cell)) }),
  instructions: z.string().optional(),
});

export type ParsedAgentPayload = z.infer<typeof agentPayloadSchema>;
