import { LlmProtocolError } from '../../domain/agent/errors/llm.protocol.error.ts';
import { type LlmEvent } from '../../app/agent/ports/llm/llm.event.ts';
import { type LlmFinishReason } from '../../app/agent/ports/llm/llm.finish.reason.ts';
import { type LlmResult } from '../../app/agent/ports/llm/llm.result.ts';
import { type LlmToolCall } from '../../app/agent/ports/llm/llm.tool.call.ts';
import { type LlmUsage } from '../../app/agent/ports/llm/llm.usage.ts';

/**
 * Coletor: consome um stream e devolve o resultado agregado (spec 031, D2) - e o "generate".
 * Concatena o texto, junta as chamadas de ferramenta na ordem, guarda o ultimo `usage` e o estado
 * do provedor. Um stream sem `finish` e erro de protocolo (o adaptador deve sempre fechar).
 */
export async function collectStream(events: AsyncIterable<LlmEvent>): Promise<LlmResult> {
  let text = '';
  const toolCalls: LlmToolCall[] = [];
  let usage: LlmUsage | null = null;
  let finish: LlmFinishReason | null = null;
  let providerState: unknown;
  let hasProviderState = false;
  for await (const event of events) {
    switch (event.type) {
      case 'text_delta':
        text += event.text;
        break;
      case 'tool_call':
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
  if (finish === null) {
    throw new LlmProtocolError('o stream terminou sem motivo de fim', text !== '' || toolCalls.length > 0);
  }
  return hasProviderState ? { text, toolCalls, usage, finish, providerState } : { text, toolCalls, usage, finish };
}
