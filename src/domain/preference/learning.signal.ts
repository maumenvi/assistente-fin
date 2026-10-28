/** Detector que gerou o sinal (spec 032, contracts/learning.md). */
export type LearningSignalKind = 'style_feedback' | 'reformulation' | 'repeated_choice';

/**
 * Observacao do comportamento do proprio usuario que reforca ou cria uma candidata. Fica so no
 * aparelho (nao sincroniza). `messageId` e sempre uma mensagem do usuario - nunca de ferramenta.
 */
export interface LearningSignal {
  readonly id: string;
  readonly userId: string;
  /** `topic` ou `topic:valor` (ex.: `response_length:short`). */
  readonly key: string;
  readonly kind: LearningSignalKind;
  readonly messageId: string;
  readonly at: string;
}
