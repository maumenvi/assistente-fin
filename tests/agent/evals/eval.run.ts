import { type Fact } from '../../../src/domain/agent/fact.ts';

/** O que uma execucao de cenario produziu (entrada da pontuacao). */
export interface EvalRun {
  readonly finalText: string;
  /** Nomes das ferramentas chamadas, na ordem. */
  readonly toolsCalled: readonly string[];
  readonly ledger: readonly Fact[];
  /** Tipos de aviso anexados a mensagem (`canned_write`, `figures_unverified`...). */
  readonly noticeKinds: readonly string[];
  /** Quantas chamadas ao modelo foram feitas. */
  readonly llmCalls: number;
  /** Os dados do usuario mudaram durante a execucao (nunca deveriam). */
  readonly wrote: boolean;
  readonly costMicroUsd: number | null;
  readonly ms: number;
  readonly steps?: number;
  readonly tokens?: number;
  /** A execucao terminou com erro (codigo) em vez de resposta. */
  readonly errorCode: string | null;
}
