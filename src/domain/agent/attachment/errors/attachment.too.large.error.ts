import { AgentError } from '../../errors/agent.error.ts';

/** Arquivo acima do limite por arquivo ou mensagem acima de 5 anexos / 20 MB. */
export class AttachmentTooLargeError extends AgentError {
  public readonly scope: 'file' | 'message';

  public constructor(scope: 'file' | 'message') {
    super(scope === 'file' ? 'ATTACHMENT_FILE_TOO_LARGE' : 'ATTACHMENT_MESSAGE_TOO_LARGE', 'anexo acima do limite');
    this.scope = scope;
  }
}
