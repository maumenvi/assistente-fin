import { AgentError } from '../../errors/agent.error.ts';

/** Tipo de arquivo nao suportado (ou extensao que nao bate com o conteudo). */
export class UnsupportedAttachmentError extends AgentError {
  public constructor() {
    super('ATTACHMENT_UNSUPPORTED', 'tipo de arquivo nao suportado');
  }
}
