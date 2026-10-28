/**
 * Um turno da conversa visto pelo aprendizado (spec 032, FR-008). O texto de `assistant` e SEMPRE
 * vazio: o aprendizado so le o que o proprio usuario escreveu - resposta do agente, resultado de
 * ferramenta, documento e comprovante nunca viram sinal. Por tipo, o detector nao tem como ler outra coisa.
 */
export interface LearningTurn {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  /** Texto do usuario; vazio nos turnos do assistente. */
  readonly text: string;
  readonly at: string;
}
