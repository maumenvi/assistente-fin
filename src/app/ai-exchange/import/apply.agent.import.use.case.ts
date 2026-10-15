import { z } from 'zod';
import { type Database } from '../../shared/database.port.ts';
import { type Clock } from '../../shared/clock.port.ts';
import { type DeterministicIdGenerator } from '../../shared/deterministic.id.generator.port.ts';
import { DuplicateTransactionError } from '../../../domain/transaction/duplicate.transaction.error.ts';
import { InvalidInputError } from '../../shared/invalid.input.error.ts';
import { type AiBatch } from '../ai.batch.ts';
import { type AiBatchOp } from '../ai.batch.op.ts';
import { type AiBatchSource } from '../ai.batch.source.ts';
import { type AiBatchStore } from '../ai.batch.store.port.ts';
import { AiBatchAlreadyAppliedError } from '../errors/ai.batch.already.applied.error.ts';
import { AiBatchApplyError } from '../errors/ai.batch.apply.error.ts';
import { AiBlockInvalidError } from '../errors/ai.block.invalid.error.ts';
import { type AgentUseCasesFactory } from './agent.use.cases.factory.ts';
import { summarizeOps } from './batch.summary.ts';
import { type PlanAgentImportUseCase, type PlanPreferences } from './plan.agent.import.use.case.ts';
import { type PlannedOp } from './planned.op.ts';
import { runOperation } from './run.operation.ts';

const inputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  text: z.string().min(1, 'texto vazio'),
  source: z.enum(['clipboard', 'share']).default('clipboard'),
});

/** Resultado de aplicar: o lote gravado no diario e as suas operacoes. */
export interface ApplyAgentImportResult {
  readonly batch: AiBatch;
  readonly ops: readonly AiBatchOp[];
}

function baseOp(batchId: string, seq: number, planned: PlannedOp): Omit<AiBatchOp, 'outcome' | 'reason' | 'entityId' | 'before' | 'after'> {
  return {
    batchId,
    seq,
    ref: planned.op.ref ?? null,
    kind: planned.op.kind,
    entity: planned.op.entity,
    op: planned.op,
    preview: {
      label: planned.label,
      amountCents: planned.amountCents,
      date: planned.date,
      installments: planned.installments,
      changes: planned.changes,
      affected: planned.affected,
      stale: planned.stale,
    },
  };
}

/**
 * Aplica o bloco (spec 029, FR-004..FR-008, R3, R4): refaz o plano, aplica so as operacoes SEGURAS
 * dentro de uma transacao do banco, pelos casos de uso do app, e grava o diario com as imagens para
 * desfazer. Destrutivas ficam `pending_destructive` ate a confirmacao propria; duplicadas e recusadas
 * so ficam registradas. Se uma operacao segura falhar, todas as seguras voltam atras e o lote vira
 * `rejected` (pode ser reenviado corrigido com o mesmo `batchId`).
 */
export class ApplyAgentImportUseCase {
  private readonly database: Database;
  private readonly store: AiBatchStore;
  private readonly planner: PlanAgentImportUseCase;
  private readonly factory: AgentUseCasesFactory;
  private readonly deterministicIds: DeterministicIdGenerator;
  private readonly clock: Clock;

  public constructor(
    database: Database,
    store: AiBatchStore,
    planner: PlanAgentImportUseCase,
    factory: AgentUseCasesFactory,
    deterministicIds: DeterministicIdGenerator,
    clock: Clock,
  ) {
    this.database = database;
    this.store = store;
    this.planner = planner;
    this.factory = factory;
    this.deterministicIds = deterministicIds;
    this.clock = clock;
  }

  public async execute(rawInput: unknown, preferences: PlanPreferences): Promise<ApplyAgentImportResult> {
    const parsed = inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('aplicar importacao da IA', flat.fieldErrors, flat.formErrors);
    }
    const { userId, text, source } = parsed.data;
    const plan = await this.planner.execute({ userId, text }, preferences);
    if (plan.status === 'already_applied') throw new AiBatchAlreadyAppliedError(plan.batchId);
    if (plan.status === 'invalid') throw new AiBlockInvalidError(plan.errors);

    const now = this.clock.now();
    const deps = { userId, batchId: plan.batchId, now, factory: this.factory, deterministicIds: this.deterministicIds };
    const ops: AiBatchOp[] = [];
    try {
      await this.database.transaction(async (transaction) => {
        ops.length = 0;
        for (const [index, planned] of plan.ops.entries()) {
          const seq = index + 1;
          const base = baseOp(plan.batchId, seq, planned);
          const pending = { entityId: null, before: null, after: null };
          if (planned.status === 'refused') {
            ops.push({ ...base, ...pending, outcome: 'rejected', reason: planned.refusal });
          } else if (planned.status === 'duplicate') {
            ops.push({ ...base, ...pending, outcome: 'skipped_duplicate', reason: 'ja existia' });
          } else if (planned.status === 'destructive') {
            ops.push({ ...base, ...pending, entityId: planned.op.id ?? null, outcome: 'pending_destructive', reason: null });
          } else {
            try {
              const result = await runOperation(transaction, planned.op, deps);
              ops.push({ ...base, entityId: result.entityId, before: result.before, after: result.after, outcome: 'applied', reason: null });
            } catch (error) {
              if (error instanceof DuplicateTransactionError) {
                ops.push({ ...base, ...pending, outcome: 'skipped_duplicate', reason: 'ja existia' });
              } else {
                throw new AiBatchApplyError(planned.opIndex, error);
              }
            }
          }
        }
      });
    } catch (error) {
      await this.store.saveBatch(this.batchOf(userId, plan.batchId, plan.snapshotId, source, 'rejected', now, []), []);
      throw error;
    }

    const summary = summarizeOps(ops);
    const status = summary.pendingDestructive > 0 ? 'partially_applied' : 'applied';
    const batch = { ...this.batchOf(userId, plan.batchId, plan.snapshotId, source, status, now, ops), summary, appliedAt: now };
    await this.store.saveBatch(batch, ops);
    return { batch, ops };
  }

  private batchOf(userId: string, batchId: string, snapshotId: string | null, source: AiBatchSource, status: AiBatch['status'], now: Date, ops: readonly AiBatchOp[]): AiBatch {
    return { batchId, userId, snapshotId, source, status, createdAt: now, appliedAt: null, undoneAt: null, summary: summarizeOps(ops) };
  }
}
