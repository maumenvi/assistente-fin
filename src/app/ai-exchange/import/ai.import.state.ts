import { type AiBlockIssue } from '../errors/ai.block.invalid.error.ts';
import { type AgentImportPlan } from './agent.import.plan.ts';
import { type ApplyAgentImportResult } from './apply.agent.import.use.case.ts';
import { type AiBatchSource } from '../ai.batch.source.ts';

/** Onde esta a importacao do bloco do agente (spec 029, telas 5, 6, 7 e 8). */
export type AiImportState =
  | { readonly phase: 'idle' }
  /** Plano pronto para a confirmacao de um toque (tela 5). */
  | { readonly phase: 'planned'; readonly plan: AgentImportPlan; readonly text: string; readonly source: AiBatchSource }
  /** Bloco fora do formato ou com referencias invalidas (tela 8). */
  | { readonly phase: 'invalid'; readonly issues: readonly AiBlockIssue[] }
  | { readonly phase: 'applying' }
  /** Lote salvo (tela 7); destrutivas pendentes seguem para a tela 6. */
  | { readonly phase: 'applied'; readonly result: ApplyAgentImportResult }
  | { readonly phase: 'failed'; readonly error: unknown };

export const IDLE_IMPORT_STATE: AiImportState = { phase: 'idle' };
