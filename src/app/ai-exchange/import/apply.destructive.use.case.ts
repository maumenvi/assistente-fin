import { z } from 'zod';
import { type Database } from '../../shared/database.port.ts';
import { type Clock } from '../../shared/clock.port.ts';
import { type DeterministicIdGenerator } from '../../shared/deterministic.id.generator.port.ts';
import { InvalidInputError } from '../../shared/invalid.input.error.ts';
import { type AiBatch } from '../ai.batch.ts';
import { type AiBatchOp } from '../ai.batch.op.ts';
import { type AiBatchStore } from '../ai.batch.store.port.ts';
import { AiBatchApplyError } from '../errors/ai.batch.apply.error.ts';
import { AiBatchNotFoundError } from '../errors/ai.batch.not.found.error.ts';
import { AiBatchStateError } from '../errors/ai.batch.state.error.ts';
import { type AgentUseCasesFactory } from './agent.use.cases.factory.ts';
import { summarizeOps } from './batch.summary.ts';
import { findOperationHandler } from './handler.registry.ts';
import { runOperation } from './run.operation.ts';

const inputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  batchId: z.string().trim().min(1, 'batchId obrigatorio'),
  /** `seq` das operacoes que o usuario confirmou na tela de apagar; as demais sao recusadas. */
  confirmedSeqs: z.array(z.int().min(1)),
});

/**
 * Executa as operacoes destrutivas pendentes que o usuario confirmou na tela propria (spec 029,
 * FR-006, US3): sem o `confirm: true` do bloco E o toque do usuario, nada roda. As nao confirmadas
 * viram `rejected`, sem descartar o que ja foi salvo. Reinspeciona cada item no momento de executar.
 */
export class ApplyDestructiveUseCase {
  private readonly database: Database;
  private readonly store: AiBatchStore;
  private readonly factory: AgentUseCasesFactory;
  private readonly deterministicIds: DeterministicIdGenerator;
  private readonly clock: Clock;

  public constructor(database: Database, store: AiBatchStore, factory: AgentUseCasesFactory, deterministicIds: DeterministicIdGenerator, clock: Clock) {
    this.database = database;
    this.store = store;
    this.factory = factory;
    this.deterministicIds = deterministicIds;
    this.clock = clock;
  }

  public async execute(rawInput: unknown): Promise<{ batch: AiBatch; ops: readonly AiBatchOp[] }> {
    const parsed = inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('apagar itens pedidos pela IA', flat.fieldErrors, flat.formErrors);
    }
    const { userId, batchId, confirmedSeqs } = parsed.data;
    const batch = await this.store.findBatch(userId, batchId);
    if (batch === null) throw new AiBatchNotFoundError();
    if (batch.status !== 'partially_applied') throw new AiBatchStateError('este lote nao tem itens para confirmar');

    const ops = await this.store.listOps(batchId);
    const now = this.clock.now();
    const deps = { userId, batchId, now, factory: this.factory, deterministicIds: this.deterministicIds };
    const updated: AiBatchOp[] = [...ops];

    await this.database.transaction(async (transaction) => {
      for (const [index, op] of ops.entries()) {
        if (op.outcome !== 'pending_destructive') continue;
        if (!confirmedSeqs.includes(op.seq) || op.op.confirm !== true) {
          updated[index] = { ...op, outcome: 'rejected', reason: 'recusado pelo usuario' };
          continue;
        }
        const handler = findOperationHandler(op.entity, op.kind);
        const inspection = handler === null ? null : await handler.inspect(op.op, transaction, userId, now);
        if (inspection === null || !inspection.exists) {
          updated[index] = { ...op, outcome: 'rejected', reason: 'o item ja nao existe' };
          continue;
        }
        try {
          const result = await runOperation(transaction, op.op, deps);
          updated[index] = { ...op, entityId: result.entityId, before: result.before, after: result.after, outcome: 'applied', reason: null };
        } catch (error) {
          throw new AiBatchApplyError(op.seq, error);
        }
      }
    });

    const summary = summarizeOps(updated);
    const finished: AiBatch = { ...batch, status: 'applied', summary };
    for (const op of updated) await this.store.updateOp(op);
    await this.store.updateBatch(finished);
    return { batch: finished, ops: updated };
  }
}
