import { type JsonSchema } from '../ports/llm/json.schema.ts';
import { type CannedReplies } from './canned.replies.type.ts';
import { type SystemPromptInput } from './system.prompt.input.ts';

/**
 * Conjunto de textos que o agente usa. Injetado no contexto dos nos para os testes (e a avaliacao
 * de regressao) poderem trocar o prompt de sistema por um degradado.
 */
export interface AgentPrompts {
  system(input: SystemPromptInput): string;
  /** Instrucao extra do modo `preference` (spec 032): so ferramentas de memoria. */
  preferenceMode(): string;
  /** Instrucao extra do modo `write_request` (spec 033): so propor planos, nunca gravar. */
  writeMode(): string;
  /** Instrucao do resumidor da conversa (spec 032, compactacao). */
  compactionSystem(): string;
  /** Instrucao do classificador de intencao (modelo rapido). */
  routerSystem(): string;
  /** Schema da saida estruturada do classificador. */
  readonly routerSchema: JsonSchema;
  readonly canned: CannedReplies;
}
