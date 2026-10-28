import { type ModelCapabilities } from '../../../../domain/agent/model.capabilities.ts';
import { type LlmEvent } from './llm.event.ts';
import { type LlmRequest } from './llm.request.ts';

/**
 * Uma origem de modelo ja configurada (perfil + fetch + segredo resolvido). O agente so conhece
 * isto (spec 031, D1/D2). `generate` nao existe aqui: e o coletor `collectStream` sobre `stream`.
 */
export interface LlmPort {
  readonly capabilities: ModelCapabilities;
  /** Unico metodo de geracao. Cancelar pelo `signal` encerra o iterador e lanca `RunCancelledError`. */
  stream(request: LlmRequest, signal?: AbortSignal): AsyncIterable<LlmEvent>;
}
