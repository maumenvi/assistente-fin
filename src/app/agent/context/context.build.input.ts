import { type AgentMessage } from '../../../domain/agent/agent.message.ts';
import { type ModelCapabilities } from '../../../domain/agent/model.capabilities.ts';
import { type ConversationSummary } from '../../../domain/agent/summary/conversation.summary.ts';
import { type Preference } from '../../../domain/preference/preference.ts';
import { type LlmMessage } from '../ports/llm/llm.message.ts';

/** Entrada da montagem do contexto enviado ao modelo. */
export interface ContextBuildInput {
  readonly system: string;
  /** Historico da conversa (do armazenamento), em ordem cronologica, SEM a pergunta atual. */
  readonly history: readonly AgentMessage[];
  /** Mensagens da rodada em curso (pergunta atual, chamadas e resultados de ferramentas). */
  readonly turn: readonly LlmMessage[];
  readonly capabilities: ModelCapabilities;
  /** Preferencias ja selecionadas por relevancia e privacidade (spec 032); o texto delas entra em `system`. */
  readonly preferences: readonly Preference[];
  /** Resumo corrente da conversa (spec 032): as mensagens ate `coveredToSeq` ja nao vao ao modelo. */
  readonly summary: ConversationSummary | null;
}
