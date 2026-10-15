import { type PlannedChange } from './import/planned.op.ts';

/**
 * Como a operacao aparecia no plano (spec 029, FR-010): fica no diario para as telas de resultado,
 * de confirmacao de apagar e de historico mostrarem o item sem refazer a leitura do banco.
 */
export interface OpPreview {
  readonly label: string | null;
  readonly amountCents: number | null;
  readonly date: string | null;
  readonly installments: number | null;
  /** Em ajustes: o que muda, com o valor atual (tela 6, "atual -> novo"). */
  readonly changes: readonly PlannedChange[];
  /** Quantos registros a operacao toca (grupo parcelado). */
  readonly affected: number;
  /** Os dados mudaram desde a copia do agente. */
  readonly stale: boolean;
}
