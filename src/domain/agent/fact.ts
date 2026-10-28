/**
 * Fato citavel numa resposta (spec 031, FR-007): todo valor, data, percentual ou quantidade que o
 * agente apresenta precisa estar entre os fatos devolvidos pelas ferramentas.
 *
 * Dinheiro e SEMPRE em centavos inteiros (`value` numerico). `display` e a string pt-BR ja
 * formatada que o modelo deve citar (ex.: "R$ 1.284,60").
 */
export interface Fact {
  readonly id: string;
  readonly kind: 'money' | 'percent' | 'date' | 'count';
  readonly value: number | string;
  readonly display: string;
  readonly label: string;
  /** Id da chamada de ferramenta que produziu o fato. */
  readonly sourceCallId: string;
  /**
   * Veio de uma capacidade externa (spec 034): pode ser CITADO na resposta, mas nunca conta como valor que o usuario
   * ja conhece/aprovou (nao evita o alerta de divergencia de um plano nem libera aprovacao automatica).
   */
  readonly external?: boolean | undefined;
}
