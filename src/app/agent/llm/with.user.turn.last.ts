import { type LlmPort } from '../ports/llm/llm.port.ts';
import { type LlmRequest } from '../ports/llm/llm.request.ts';
import { type LlmEvent } from '../ports/llm/llm.event.ts';
import { ensureUserTurnLast } from './ensure.user.turn.last.ts';

/**
 * Decora um `LlmPort` para que todo pedido termine em turno do usuario (spec 040, R4). Fica na
 * fronteira do porto: cobre "Continuar", "Tentar de novo" e qualquer caminho futuro de uma vez.
 */
export function withUserTurnLast(inner: LlmPort): LlmPort {
  return {
    capabilities: inner.capabilities,
    stream(request: LlmRequest, signal?: AbortSignal): AsyncIterable<LlmEvent> {
      return inner.stream({ ...request, messages: ensureUserTurnLast(request.messages) }, signal);
    },
  };
}
