import { type LlmFinishReason } from './llm.finish.reason.ts';
import { type LlmUsage } from './llm.usage.ts';

/**
 * Evento do stream de um modelo. Garantias (testadas na suite de contrato): `tool_call` so sai
 * COMPLETO; `finish` sai exatamente uma vez e por ultimo; `usage` no maximo uma vez; falhas LANCAM
 * um erro (nao viram evento).
 */
export type LlmEvent =
  | { readonly type: 'text_delta'; readonly text: string }
  | { readonly type: 'reasoning_delta'; readonly text: string }
  | {
      readonly type: 'tool_call';
      readonly id: string;
      readonly name: string;
      readonly args: unknown;
      /** Presente quando os argumentos nao puderam ser interpretados (`args` fica `null`). */
      readonly argsError?: string;
      /** Extra do provedor que deve voltar com a chamada (assinatura de pensamento do Gemini); opaco para o agente. */
      readonly extra?: unknown;
    }
  | { readonly type: 'provider_state'; readonly state: unknown }
  | ({ readonly type: 'usage' } & LlmUsage)
  | { readonly type: 'finish'; readonly reason: LlmFinishReason };
