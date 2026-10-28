import { LlmProtocolError } from '../../../../domain/agent/errors/llm.protocol.error.ts';
import { type LlmEvent } from '../../ports/llm/llm.event.ts';
import { type LlmFinishReason } from '../../ports/llm/llm.finish.reason.ts';
import { type LlmToolCall } from '../../ports/llm/llm.tool.call.ts';
import { type LlmUsage } from '../../ports/llm/llm.usage.ts';
import { type ModelTurn } from './model.turn.ts';

/** Texto acumulado ate agora; quem chama le `text` se a geracao falhar no meio. */
export interface TurnProgress {
  text: string;
  emittedContent: boolean;
}

/**
 * Consome o stream de uma geracao repassando cada pedaco de texto ASSIM QUE CHEGA (`onText`, sem
 * esperar nenhuma gravacao). Acumula em `progress` para o chamador salvar o parcial se der erro.
 */
export async function streamModelTurn(
  events: AsyncIterable<LlmEvent>,
  progress: TurnProgress,
  onText: (text: string) => void,
): Promise<ModelTurn> {
  const toolCalls: LlmToolCall[] = [];
  let usage: LlmUsage | null = null;
  let finish: LlmFinishReason | null = null;
  let providerState: unknown;
  let hasProviderState = false;
  for await (const event of events) {
    switch (event.type) {
      case 'text_delta':
        progress.text += event.text;
        progress.emittedContent = true;
        onText(event.text);
        break;
      case 'tool_call':
        progress.emittedContent = true;
        toolCalls.push(
          event.argsError === undefined
            ? { id: event.id, name: event.name, args: event.args, ...(event.extra === undefined ? {} : { extra: event.extra }) }
            : { id: event.id, name: event.name, args: null, argsError: event.argsError, ...(event.extra === undefined ? {} : { extra: event.extra }) },
        );
        break;
      case 'provider_state':
        providerState = event.state;
        hasProviderState = true;
        break;
      case 'usage': {
        const { type: _type, ...rest } = event;
        usage = rest;
        break;
      }
      case 'finish':
        finish = event.reason;
        break;
      default:
        break;
    }
  }
  if (finish === null) throw new LlmProtocolError('o stream terminou sem motivo de fim', progress.emittedContent);
  return hasProviderState ? { text: progress.text, toolCalls, usage, finish, providerState } : { text: progress.text, toolCalls, usage, finish };
}
