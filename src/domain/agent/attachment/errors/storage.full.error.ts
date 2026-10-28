import { AgentError } from '../../errors/agent.error.ts';

/** Sem espaco no aparelho para guardar o anexo. */
export class StorageFullError extends AgentError {
  public constructor() {
    super('ATTACHMENT_STORAGE_FULL', 'sem espaco no aparelho');
  }
}
