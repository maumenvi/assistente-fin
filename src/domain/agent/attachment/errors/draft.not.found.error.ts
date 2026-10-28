import { AgentError } from '../../errors/agent.error.ts';

/** Rascunho de anexo inexistente, expirado ou de outro usuario. */
export class DraftNotFoundError extends AgentError {
  public constructor() {
    super('ATTACHMENT_DRAFT_NOT_FOUND', 'rascunho de anexo nao encontrado');
  }
}
