import { type JsonSchema } from './json.schema.ts';
import { type LlmMessage } from './llm.message.ts';
import { type ToolSpec } from './tool.spec.ts';

/** Pedido de geracao ao modelo (spec 031, contracts/llm.port.md). */
export interface LlmRequest {
  readonly system: string;
  readonly messages: readonly LlmMessage[];
  /** So e enviado quando `capabilities.tools`. */
  readonly tools?: readonly ToolSpec[];
  readonly toolChoice?: 'auto' | 'none';
  /** Saida estruturada: o modelo responde com JSON que obedece ao schema. */
  readonly output?: { readonly name: string; readonly schema: JsonSchema };
  readonly maxOutputTokens?: number;
  /** Padrao 0 para consulta. */
  readonly temperature?: number;
}
