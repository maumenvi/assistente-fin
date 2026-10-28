import { AgentError } from '../../errors/agent.error.ts';

/** Envio com anexo ainda sendo lido. */
export class DraftStillReadingError extends AgentError {
  public constructor() {
    super('ATTACHMENT_DRAFT_READING', 'anexo ainda sendo lido');
  }
}
