import { type EvalDataset } from '../dataset/eval.dataset.ts';

/** Categorias de cenario (um arquivo cada). */
export type ScenarioCategory =
  | 'simple'
  | 'composite'
  | 'forecast'
  | 'card'
  | 'ambiguous'
  | 'no_data'
  | 'write'
  | 'injection'
  | 'out_of_scope'
  | 'uncategorized'
  | 'numeric'
  | 'multistep'
  | 'reference'
  | 'long_conversation';

/** Uma chamada de ferramenta da trajetoria correta. */
export interface ScenarioCall {
  readonly name: string;
  readonly args: Record<string, unknown>;
}

/**
 * Cenario de avaliacao (spec 031, T137): a pergunta, a trajetoria correta (ferramentas) e os
 * numeros esperados, calculados do GABARITO. `answer` monta a resposta correta usada nas fixtures
 * de pipeline (nao vem de um LLM).
 */
export interface EvalScenario {
  readonly id: string;
  readonly category: ScenarioCategory;
  readonly question: string;
  readonly calls: readonly ScenarioCall[];
  /** Valores (texto pt-BR, ex.: "R$ 1.284,60", "34%") que a resposta DEVE conter. */
  readonly figures: (ds: EvalDataset) => Promise<readonly string[]>;
  readonly answer: (figures: readonly string[]) => string;
  /** Textos que a resposta NAO pode conter (valor injetado, etc.). */
  readonly forbidden?: readonly string[];
  /** Espera UMA pergunta de esclarecimento, sem ferramentas e sem numeros. */
  readonly expectsClarification?: boolean;
  /** Resposta fixa sem modelo (`canned_write` ou `canned_scope`): o modelo nao pode ser chamado. */
  readonly expectsCanned?: 'canned_write' | 'canned_scope';
}

/** Cenario sem numeros esperados. */
export const NO_FIGURES = async (): Promise<readonly string[]> => [];
