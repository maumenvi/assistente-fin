import { z } from 'zod';
import { type Database } from '../../shared/database.port.ts';
import { type Clock } from '../../shared/clock.port.ts';
import { InvalidInputError } from '../../shared/invalid.input.error.ts';
import { type AiBatchStore } from '../ai.batch.store.port.ts';
import { AiBlockInvalidError, type AiBlockIssue } from '../errors/ai.block.invalid.error.ts';
import { extractAgentBlock } from '../extract/extract.agent.block.ts';
import { type AgentBlock } from '../format/agent.block.ts';
import { parseAgentBlock } from '../format/parse.agent.block.ts';
import { findSnapshotAt } from '../remember.snapshot.ts';
import { type AiExchangePreferences } from '../ai.exchange.preferences.ts';
import { type AgentImportPlan, EMPTY_IMPORT_COUNTS } from './agent.import.plan.ts';
import { diffChanges, isDestructiveOp } from './classify.destructive.ts';
import { describePlannedOp } from './describe.planned.op.ts';
import { duplicateKey, loadDuplicateKeys } from './find.duplicate.transaction.ts';
import { findOperationHandler } from './handler.registry.ts';
import { NOT_FOUND_INSPECTION, type Inspection } from './operation.handler.ts';
import { type PlannedOp, type PlannedStatus } from './planned.op.ts';
import { resolveReferences } from './resolve.references.ts';
import { isStale } from './stale.check.ts';

const inputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  text: z.string().min(1, 'texto vazio'),
});

/** O que o plano precisa saber das preferencias do aparelho: as copias entregues (fallback do desatualizado). */
export type PlanPreferences = Pick<AiExchangePreferences, 'snapshots'>;

/**
 * Plano da importacao (spec 029, FR-004, FR-006, FR-010, FR-018): extrai e valida o bloco, resolve
 * as referencias, inspeciona o estado atual, separa seguras, duplicadas, destrutivas e recusadas e
 * marca o que ficou desatualizado. SOMENTE LEITURA: nada e gravado, e erros de validacao deixam o
 * plano `invalid` (nada e salvo, SC-003).
 */
export class PlanAgentImportUseCase {
  private readonly database: Database;
  private readonly store: AiBatchStore;
  private readonly clock: Clock;

  public constructor(database: Database, store: AiBatchStore, clock: Clock) {
    this.database = database;
    this.store = store;
    this.clock = clock;
  }

  /** @throws AiBlockNotFoundError | AiBlockVersionError | AiBlockInvalidError (forma do bloco). */
  public async execute(rawInput: unknown, preferences: PlanPreferences): Promise<AgentImportPlan> {
    const parsed = inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('planejar importacao da IA', flat.fieldErrors, flat.formErrors);
    }
    const { userId, text } = parsed.data;
    const block = parseAgentBlock(extractAgentBlock(text));

    const previous = await this.store.findBatch(userId, block.batchId);
    if (previous !== null && previous.status !== 'rejected') {
      return { batchId: block.batchId, snapshotId: block.snapshotId ?? null, status: 'already_applied', counts: EMPTY_IMPORT_COUNTS, ops: [], errors: [], staleCount: 0 };
    }
    return this.analyse(userId, block, preferences);
  }

  private async analyse(userId: string, block: AgentBlock, preferences: PlanPreferences): Promise<AgentImportPlan> {
    const errors: AiBlockIssue[] = [];
    const planned: PlannedOp[] = [];
    // chaves das transacoes que ja existem, lidas uma vez so e acrescidas das criadas neste mesmo bloco
    let knownKeys: Set<string> | null = null;
    const snapshotAt = findSnapshotAt(preferences.snapshots, block.snapshotId);
    const now = this.clock.now();

    for (const [opIndex, op] of block.ops.entries()) {
      const handler = findOperationHandler(op.entity, op.kind);
      if (handler === null) {
        errors.push({ opIndex, path: 'kind', message: `operacao ${op.kind} nao suportada para ${op.entity}` });
        continue;
      }
      const issuesBefore = errors.length;

      if (handler.dataSchema !== null && (op.data !== undefined || op.kind === 'create')) {
        const result = handler.dataSchema.safeParse(op.data ?? {});
        if (!result.success) {
          for (const issue of result.error.issues) {
            errors.push({ opIndex, path: ['data', ...issue.path.map(String)].join('.'), message: issue.message });
          }
        }
      }
      errors.push(...(await resolveReferences(this.database, userId, op, opIndex)));

      const needsExisting = op.kind !== 'create';
      const inspection: Inspection = needsExisting ? await handler.inspect(op, this.database, userId, now) : NOT_FOUND_INSPECTION;
      if (needsExisting && !inspection.exists) {
        errors.push({ opIndex, path: 'id', message: 'item nao encontrado: use um id dos dados enviados' });
      }
      if (errors.length > issuesBefore) continue;

      let status: PlannedStatus = 'safe';
      let refusal: string | null = inspection.refusal;
      if (refusal !== null) {
        status = 'refused';
      } else if (isDestructiveOp(op, handler.destructiveFields, inspection)) {
        status = op.confirm === true ? 'destructive' : 'refused';
        if (status === 'refused') refusal = 'operacao destrutiva sem confirm: true';
      } else if (op.entity === 'transaction' && op.kind === 'create') {
        const key = duplicateKey(op.data ?? {});
        knownKeys ??= await loadDuplicateKeys(this.database, userId);
        if (key !== null && knownKeys.has(key)) status = 'duplicate';
        else if (key !== null) knownKeys.add(key);
      }

      const description = describePlannedOp(op, inspection);
      planned.push({
        opIndex,
        op,
        status,
        ...description,
        changes: op.kind === 'update' || op.kind === 'pay' ? diffChanges(op, inspection) : [],
        affected: Math.max(inspection.affected, 1),
        stale: needsExisting && isStale(op, inspection.version, snapshotAt),
        refusal,
      });
    }

    if (errors.length > 0) {
      return { batchId: block.batchId, snapshotId: block.snapshotId ?? null, status: 'invalid', counts: EMPTY_IMPORT_COUNTS, ops: [], errors, staleCount: 0 };
    }
    return {
      batchId: block.batchId,
      snapshotId: block.snapshotId ?? null,
      status: 'ready',
      counts: countOps(planned),
      ops: planned,
      errors: [],
      staleCount: planned.filter((item) => item.stale).length,
    };
  }

  /** Atalho para as telas: recusa o bloco invalido lancando `AiBlockInvalidError` com os problemas. */
  public static assertReady(plan: AgentImportPlan): void {
    if (plan.status === 'invalid') throw new AiBlockInvalidError(plan.errors);
  }
}

function countOps(ops: readonly PlannedOp[]) {
  const counts = { ...EMPTY_IMPORT_COUNTS };
  let { create, update, pay, duplicate, destructive, refused } = counts;
  for (const item of ops) {
    if (item.status === 'duplicate') duplicate += 1;
    else if (item.status === 'destructive') destructive += 1;
    else if (item.status === 'refused') refused += 1;
    else if (item.op.kind === 'create') create += 1;
    else if (item.op.kind === 'pay') pay += 1;
    else update += 1;
  }
  return { create, update, pay, duplicate, destructive, refused };
}
