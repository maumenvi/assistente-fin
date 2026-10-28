/** Limites que toda ferramenta respeita (spec 031, contracts/tool.port.md). */
export interface ToolLimits {
  /** Maximo de itens na amostra devolvida ao modelo (padrao 10). */
  readonly maxItems: number;
  /** Maximo de caracteres do texto enviado ao modelo (padrao 6.000). */
  readonly maxChars: number;
  /** Tempo maximo por ferramenta, em ms (padrao 10 s). */
  readonly timeoutMs: number;
}
