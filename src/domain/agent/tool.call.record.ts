/** Registro de uma chamada de ferramenta dentro de um passo (spec 031, data-model.md 1). */
export interface ToolCallRecord {
  readonly id: string;
  readonly name: string;
  readonly args: unknown;
  /** Resumo curto do resultado (nao o resultado completo). */
  readonly resultSummary: string;
  readonly ms: number;
  /** Verdadeiro quando o resultado guardado foi cortado no teto. */
  readonly truncated: boolean;
  /** Chamada a uma capacidade externa (spec 034): a tela de execucao mostra a marca de injecao e o bloqueio de saida. */
  readonly external?: { readonly capability: string; readonly suspectedInjection: boolean; readonly blocked: 'egress' | 'schema' | 'size' | null } | undefined;
}
