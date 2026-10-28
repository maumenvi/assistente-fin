/** Tempos limite de uma chamada ao modelo (spec 031, D5). */
export interface LlmTimeouts {
  /** Ate os cabecalhos da resposta chegarem. */
  readonly connectMs: number;
  /** Dos cabecalhos ate o primeiro evento do stream. */
  readonly firstContentMs: number;
  /** Silencio maximo entre eventos depois do primeiro. */
  readonly idleMs: number;
}
