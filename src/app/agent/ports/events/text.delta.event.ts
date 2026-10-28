import { type AgentEventBase } from './agent.event.base.ts';

/** Pedaco de texto da resposta, publicado assim que o modelo o gera (sem esperar gravacao). */
export interface TextDeltaEvent extends AgentEventBase {
  readonly type: 'text_delta';
  readonly messageId: string;
  readonly text: string;
}
