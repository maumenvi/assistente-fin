import { type ModelRole } from '../../../domain/agent/model.role.ts';
import { type LlmTier } from '../../../domain/agent/routing/llm.tier.ts';
import { type ToolCallRecord } from '../../../domain/agent/tool.call.record.ts';

/**
 * O que um no informa sobre o passo que acabou de executar, para o runner montar o `RunStep`,
 * somar o consumo e atualizar o checkpoint. Todos os campos sao opcionais (nos sem LLM nao
 * informam modelo nem tokens).
 */
export interface StepDetail {
  readonly role?: ModelRole;
  readonly tier?: LlmTier;
  readonly model?: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly cachedTokens?: number;
  readonly costMicroUsd?: number | null;
  readonly toolCalls?: readonly ToolCallRecord[];
  /** Mensagens enviadas ao modelo (o trace aplica o teto de 32 KB). */
  readonly request?: unknown;
  /** Resposta bruta resumida. */
  readonly response?: unknown;
  /** O perfil alternativo respondeu no lugar do principal neste passo. */
  readonly fallbackUsed?: boolean;
}
