import { type MessageStatus } from '../../../domain/agent/agent.message.ts';
import { type MessagePart } from '../../../domain/agent/message.part.ts';

/** Mensagem como a tela a desenha: partes (texto, cartoes "Consultei", avisos) e estado. */
export interface ViewMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant';
  readonly parts: readonly MessagePart[];
  readonly status: MessageStatus;
  readonly errorCode: string | null;
  /** Ordem na conversa (paginacao para tras); `null` na pergunta mostrada antes de gravar. */
  readonly seq: number | null;
  /** Execucao que gerou a resposta (para parar uma resposta orfa depois de recarregar a tela). */
  readonly runId: string | null;
}
