/**
 * Chamada de ferramenta pedida pelo modelo. `args` ja vem interpretado; se os argumentos nao
 * puderam ser lidos, `args` e `null` e `argsError` explica (o agente devolve o erro ao modelo).
 */
export interface LlmToolCall {
  readonly id: string;
  readonly name: string;
  readonly args: unknown;
  readonly argsError?: string;
  /** Extra do provedor devolvido com a chamada; reenviado no turno seguinte (Gemini exige a `thought_signature`). */
  readonly extra?: unknown;
}
