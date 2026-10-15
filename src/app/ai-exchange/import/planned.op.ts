import { type AgentOp } from '../format/agent.op.ts';
import { type DisplayValue } from './operation.handler.ts';

/**
 * Situacao de uma operacao no plano (spec 029, FR-006, FR-010): `safe` aplica com um toque;
 * `destructive` espera a tela de confirmacao propria; `duplicate` ja existia; `refused` o app nao
 * executa (falta `confirm`, ou o item esta fora da v1) e o motivo vai para o usuario.
 */
export type PlannedStatus = 'safe' | 'duplicate' | 'destructive' | 'refused';

/** Um campo que a operacao muda: "atual -> novo" (tela 6). */
export interface PlannedChange {
  readonly field: string;
  readonly from: DisplayValue;
  readonly to: DisplayValue;
}

/** Uma operacao do bloco ja analisada, com o que a tela precisa para mostra-la. */
export interface PlannedOp {
  readonly opIndex: number;
  readonly op: AgentOp;
  readonly status: PlannedStatus;
  /** Rotulo curto (descricao, origem, observacoes), ou `null`. */
  readonly label: string | null;
  readonly amountCents: number | null;
  readonly date: string | null;
  readonly installments: number | null;
  /** Em `update`/`pay`: o que muda, com o valor atual. */
  readonly changes: readonly PlannedChange[];
  /** Quantos registros a operacao toca (grupo parcelado). */
  readonly affected: number;
  /** Os dados mudaram desde a copia em que o agente se baseou (FR-018). */
  readonly stale: boolean;
  /** Motivo de `refused`. */
  readonly refusal: string | null;
}
