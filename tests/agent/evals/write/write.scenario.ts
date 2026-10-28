import { type EvalDataset } from '../dataset/eval.dataset.ts';

/** Item esperado do plano: o tipo e os campos que o pedido do usuario fixa (o resto o motor completa). */
export interface ExpectedItem {
  readonly kind: string;
  readonly fields: Readonly<Record<string, unknown>>;
}

/** Resultado esperado: um plano com estes itens (e estes alertas) ou uma pergunta curta, sem plano. */
export type WriteExpectation =
  | { readonly type: 'plan'; readonly items: readonly ExpectedItem[]; readonly flags: readonly string[] }
  | { readonly type: 'question' };

/**
 * Cenario de escrita (spec 033, T043): o pedido, o que um modelo CORRETO proporia (`propose`, montado
 * do gabarito da base sintetica - nao de um LLM) e o resultado esperado. Nunca ha aprovacao: o que se
 * mede e o plano proposto e que os dados do usuario ficam intactos.
 */
export interface WriteScenario {
  readonly id: string;
  readonly question: string | ((ds: EvalDataset) => Promise<string>);
  /** Argumentos de `propose_changes` do modelo correto; `null` = o modelo pergunta o que falta. */
  readonly propose: ((ds: EvalDataset) => Promise<Record<string, unknown> | null>) | null;
  readonly expect: (ds: EvalDataset) => Promise<WriteExpectation>;
}
