import { AgentError } from '../../errors/agent.error.ts';

/** Anexo inexistente, ja apagado ou de outro usuario. */
export class AttachmentNotFoundError extends AgentError {
  public constructor() {
    super('ATTACHMENT_NOT_FOUND', 'anexo nao encontrado');
  }
}
