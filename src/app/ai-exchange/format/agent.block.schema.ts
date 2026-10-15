import { z } from 'zod';
import { AGENT_ENTITIES } from './agent.entity.ts';
import { AGENT_OP_KINDS } from './agent.op.kind.ts';
import { AGENT_OP_MATRIX } from './agent.op.matrix.ts';
import { AGENT_BLOCK_LIMITS } from './agent.block.limits.ts';
import { type AgentBlock } from './agent.block.ts';

/** Percorre `data` e devolve o caminho da primeira string maior que o limite, ou `null`. */
function findLongString(value: unknown, path: string): string | null {
  if (typeof value === 'string') {
    return value.length > AGENT_BLOCK_LIMITS.maxStringLength ? path : null;
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findLongString(value[index], `${path}.${index}`);
      if (found !== null) return found;
    }
    return null;
  }
  if (typeof value === 'object' && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      const found = findLongString(item, `${path}.${key}`);
      if (found !== null) return found;
    }
  }
  return null;
}

const opSchema = z
  .object({
    ref: z.string().trim().min(1).max(AGENT_BLOCK_LIMITS.maxRefLength).optional(),
    kind: z.enum(AGENT_OP_KINDS),
    entity: z.enum(AGENT_ENTITIES),
    id: z.string().trim().min(1).max(64).optional(),
    data: z.record(z.string(), z.unknown()).optional(),
    expectV: z.iso.datetime({ offset: true }).optional(),
    confirm: z.literal(true).optional(),
  })
  .strict()
  .superRefine((op, ctx) => {
    if (!AGENT_OP_MATRIX[op.entity].includes(op.kind)) {
      ctx.addIssue({ code: 'custom', path: ['kind'], message: `operacao ${op.kind} nao suportada para ${op.entity}` });
      return;
    }
    if (op.kind === 'create') {
      if (op.ref === undefined) ctx.addIssue({ code: 'custom', path: ['ref'], message: 'ref obrigatorio em create' });
      if (op.data === undefined) ctx.addIssue({ code: 'custom', path: ['data'], message: 'data obrigatorio em create' });
    } else if (op.id === undefined) {
      ctx.addIssue({ code: 'custom', path: ['id'], message: `id obrigatorio em ${op.kind}` });
    }
    if (op.kind === 'update' && op.data === undefined) {
      ctx.addIssue({ code: 'custom', path: ['data'], message: 'data obrigatorio em update' });
    }
    const long = op.data === undefined ? null : findLongString(op.data, 'data');
    if (long !== null) {
      ctx.addIssue({ code: 'custom', path: long.split('.'), message: `texto maior que ${AGENT_BLOCK_LIMITS.maxStringLength} caracteres` });
    }
  });

/**
 * Esquema do bloco que o agente devolve (spec 029, contracts/agent.block.format.md). So a forma:
 * os campos de `data` de cada entidade sao validados no plano, contra os esquemas dos casos de uso.
 * Zod fica na borda (constituicao III): este arquivo nunca e importado pelo dominio.
 */
export const agentBlockSchema = z
  .object({
    batchId: z
      .string()
      .min(AGENT_BLOCK_LIMITS.batchIdMin)
      .max(AGENT_BLOCK_LIMITS.batchIdMax)
      .regex(/^[A-Za-z0-9_-]+$/, 'batchId aceita so letras, numeros, _ e -'),
    snapshotId: z.string().min(1).max(64).optional(),
    ops: z.array(opSchema).min(1).max(AGENT_BLOCK_LIMITS.maxOps),
  })
  .strict()
  .superRefine((block, ctx) => {
    const seen = new Set<string>();
    block.ops.forEach((op, index) => {
      if (op.kind !== 'create' || op.ref === undefined) return;
      if (seen.has(op.ref)) {
        ctx.addIssue({ code: 'custom', path: ['ops', index, 'ref'], message: 'ref repetido no lote' });
      }
      seen.add(op.ref);
    });
  });
