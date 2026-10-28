/**
 * Resumo de uma consulta feita pelo agente (spec 031, FR-004): vira o cartao "Consultei: ..." e
 * e o que sobrevive no contexto de turnos antigos no lugar do resultado completo.
 */
export interface QuerySummary {
  /** Id da ferramenta (ex.: `query_transactions`). */
  readonly tool: string;
  /** Rotulo legivel, em pt-BR (ex.: "lancamentos de set/2026 - categoria Mercado"). */
  readonly label: string;
  readonly filters: Readonly<Record<string, string>>;
  readonly itemCount: number;
  /** Verdadeiro quando o resultado enviado ao modelo foi cortado (amostra). */
  readonly truncated: boolean;
}
