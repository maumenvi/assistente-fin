import { LlmError } from './llm.error.ts';
import { type LlmProtocolStage } from './llm.protocol.stage.ts';

/** Codigo do erro por etapa; sem etapa conhecida vale o codigo generico `LLM_PROTOCOL`. */
const CODE_BY_STAGE: Readonly<Record<LlmProtocolStage, string>> = Object.freeze({
  chunk_invalido: 'LLM_PROTOCOL_CHUNK',
  fim_inesperado: 'LLM_PROTOCOL_END',
  sem_saida: 'LLM_PROTOCOL_EMPTY',
});

/**
 * Resposta do provedor fora do formato esperado (JSON/SSE invalido, fim de stream inesperado).
 * Com `stage` (spec 037), o codigo diz a etapa que falhou para a mensagem ao usuario ser
 * especifica; a mensagem tecnica nunca carrega conteudo da conversa.
 */
export class LlmProtocolError extends LlmError {
  public readonly stage: LlmProtocolStage | null;

  public constructor(message = 'resposta do provedor fora do formato', emittedContent = false, stage: LlmProtocolStage | null = null) {
    super(stage === null ? 'LLM_PROTOCOL' : CODE_BY_STAGE[stage], message, false, emittedContent);
    this.stage = stage;
  }
}
