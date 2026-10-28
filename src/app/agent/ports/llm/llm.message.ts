import { type LlmContentPart } from './llm.content.part.ts';
import { type LlmToolCall } from './llm.tool.call.ts';

/**
 * Mensagem na conversa com o modelo. `providerState` e opaco: o adaptador o preenche (ex.: blocos
 * de raciocinio que o provedor exige de volta apos uma chamada de ferramenta) e o agente o devolve
 * intacto na rodada seguinte, sem interpretar.
 */
export type LlmMessage =
  | { readonly role: 'user'; readonly content: readonly LlmContentPart[] }
  | {
      readonly role: 'assistant';
      readonly content: readonly LlmContentPart[];
      readonly toolCalls?: readonly LlmToolCall[];
      readonly providerState?: unknown;
    }
  | { readonly role: 'tool'; readonly toolCallId: string; readonly content: string };
