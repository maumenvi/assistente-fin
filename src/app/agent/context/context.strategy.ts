import { type LlmMessage } from '../ports/llm/llm.message.ts';
import { type ContextBuildInput } from './context.build.input.ts';

/**
 * Decide o que do historico vai ao modelo (spec 031, D12). A implementacao padrao descarta com
 * seguranca o que nao cabe; a spec 032 pluga a compactacao e as preferencias aqui.
 */
export interface ContextStrategy {
  build(input: ContextBuildInput): readonly LlmMessage[];
}
