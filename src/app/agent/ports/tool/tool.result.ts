import { type Fact } from '../../../../domain/agent/fact.ts';
import { type QuerySummary } from '../../../../domain/agent/query.summary.ts';
import { type PlanStatus } from '../../../../domain/plan/plan.status.ts';
import { type ToolError } from './tool.error.ts';

/** Resultado de uma ferramenta de consulta. */
export interface ToolResult {
  readonly ok: boolean;
  /** Texto para o modelo, dentro de `<dados origem="...">...</dados>`, ate `limits.maxChars`. */
  readonly contentForModel: string;
  /** Fatos citaveis (dinheiro em centavos); alimentam o ledger de verificacao. */
  readonly facts: readonly Fact[];
  /** O que aparece no cartao "Consultei: ..." e sobrevive no contexto antigo. */
  readonly summary: QuerySummary;
  readonly error?: ToolError;
  /**
   * Ferramenta de memoria (spec 032): nao vira cartao "Consultei" nem entra nos resumos da
   * resposta - preferencia nao e consulta aos dados financeiros.
   */
  readonly hidden?: boolean;
  /** `propose_changes` (spec 033): o plano criado; o no `tools` o anexa a mensagem como cartao. */
  /** `find_capability` (spec 034): os pedidos criados (ate 3); o no `tools` os anexa a mensagem como cartoes de aprovacao. */
  readonly capabilityRequestIds?: readonly string[];
  /** Chamada a capacidade externa (spec 034): vira marca no passo da execucao. */
  readonly external?: { readonly capability: string; readonly suspectedInjection: boolean; readonly blocked: 'egress' | 'schema' | 'size' | null };
  /** `write_report` (spec 040): o relatorio salvo; o no `tools` o anexa a mensagem como cartao "Abrir". */
  readonly report?: { readonly path: string; readonly format: 'md' | 'html' };
  readonly plan?: { readonly planId: string; readonly status: PlanStatus };
}
