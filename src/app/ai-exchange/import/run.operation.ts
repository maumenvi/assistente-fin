import { type Database } from '../../shared/database.port.ts';
import { type DeterministicIdGenerator } from '../../shared/deterministic.id.generator.port.ts';
import { DerivedIdGenerator } from '../../pre-registration/derived.id.generator.ts';
import { type AgentOp } from '../format/agent.op.ts';
import { type AgentUseCasesFactory } from './agent.use.cases.factory.ts';
import { findOperationHandler } from './handler.registry.ts';
import { type HandlerResult } from './operation.handler.ts';

export interface RunOperationDeps {
  readonly userId: string;
  readonly batchId: string;
  readonly now: Date;
  readonly factory: AgentUseCasesFactory;
  readonly deterministicIds: DeterministicIdGenerator;
}

/**
 * Executa UMA operacao num ponto de salvamento do banco (spec 029, R3): se ela falhar, so ela e
 * desfeita. Os ids criados saem de `(batchId, ref)`, entao reaplicar o mesmo item nao cria outro.
 */
export async function runOperation(transaction: Database, op: AgentOp, deps: RunOperationDeps): Promise<HandlerResult> {
  const handler = findOperationHandler(op.entity, op.kind);
  if (handler === null) throw new Error(`sem handler para ${op.entity}:${op.kind}`);
  return transaction.transaction(async (inner) => {
    const ids = new DerivedIdGenerator(`${deps.batchId}:${op.ref ?? op.id ?? op.kind}`, deps.deterministicIds);
    return handler.execute(op, { userId: deps.userId, batchId: deps.batchId, database: inner, useCases: deps.factory(inner, ids), now: deps.now });
  });
}
