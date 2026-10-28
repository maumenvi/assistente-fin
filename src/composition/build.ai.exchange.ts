import { type AiBatchStore } from '../app/ai-exchange/ai.batch.store.port.ts';
import { BuildAgentPayloadUseCase } from '../app/ai-exchange/export/build.agent.payload.use.case.ts';
import { BuildShareContentUseCase } from '../app/ai-exchange/export/build.share.content.use.case.ts';
import { ApplyAgentImportUseCase } from '../app/ai-exchange/import/apply.agent.import.use.case.ts';
import { ApplyDestructiveUseCase } from '../app/ai-exchange/import/apply.destructive.use.case.ts';
import { GetAiBatchUseCase } from '../app/ai-exchange/import/get.ai.batch.use.case.ts';
import { ListAiBatchesUseCase } from '../app/ai-exchange/import/list.ai.batches.use.case.ts';
import { PlanAgentImportUseCase } from '../app/ai-exchange/import/plan.agent.import.use.case.ts';
import { UndoAgentBatchUseCase } from '../app/ai-exchange/import/undo.agent.batch.use.case.ts';
import { type AgentUseCasesFactory } from '../app/ai-exchange/import/agent.use.cases.factory.ts';
import { type Database } from '../app/shared/database.port.ts';
import { type IdGenerator } from '../app/shared/id.generator.port.ts';
import { type Clock } from '../app/shared/clock.port.ts';
import { type DeterministicIdGenerator } from '../app/shared/deterministic.id.generator.port.ts';
import { buildUseCases, type UseCaseDeps } from './build.use.cases.ts';

/** O que a troca com agentes de IA precisa da raiz de composicao (spec 029, R3). */
export interface AiExchangeDeps {
  /** As mesmas dependencias do `buildUseCases` do app, para montar os casos de uso sobre uma transacao. */
  readonly useCaseDeps: UseCaseDeps;
  readonly store: AiBatchStore;
}

/** Casos de uso da troca com agentes de IA, prontos para as telas (spec 029). */
export interface AiExchange {
  readonly buildAgentPayload: BuildAgentPayloadUseCase;
  readonly buildShareContent: BuildShareContentUseCase;
  readonly planAgentImport: PlanAgentImportUseCase;
  readonly applyAgentImport: ApplyAgentImportUseCase;
  readonly applyDestructive: ApplyDestructiveUseCase;
  readonly undoAgentBatch: UndoAgentBatchUseCase;
  readonly listAiBatches: ListAiBatchesUseCase;
  readonly getAiBatch: GetAiBatchUseCase;
}

/**
 * Monta a troca com agentes de IA (spec 029). A fabrica de casos de uso refaz o `buildUseCases`
 * sobre a transacao e o gerador de ids derivado do lote, para os ids criados serem estaveis (R2).
 */
export function buildAiExchange(deps: AiExchangeDeps): AiExchange {
  const { useCaseDeps, store } = deps;
  const database: Database = useCaseDeps.database;
  const ids: IdGenerator = useCaseDeps.ids;
  const clock: Clock = useCaseDeps.clock;
  const deterministicIds: DeterministicIdGenerator = useCaseDeps.deterministicIds;

  const factory: AgentUseCasesFactory = (transaction, derivedIds) => buildUseCases({ ...useCaseDeps, database: transaction, ids: derivedIds });
  const buildAgentPayload = new BuildAgentPayloadUseCase(database, ids, clock);
  const planAgentImport = new PlanAgentImportUseCase(database, store, clock);

  return {
    buildAgentPayload,
    buildShareContent: new BuildShareContentUseCase(buildAgentPayload),
    planAgentImport,
    applyAgentImport: new ApplyAgentImportUseCase(database, store, planAgentImport, factory, deterministicIds, clock),
    applyDestructive: new ApplyDestructiveUseCase(database, store, factory, deterministicIds, clock),
    undoAgentBatch: new UndoAgentBatchUseCase(database, store, clock),
    listAiBatches: new ListAiBatchesUseCase(store),
    getAiBatch: new GetAiBatchUseCase(store),
  };
}
