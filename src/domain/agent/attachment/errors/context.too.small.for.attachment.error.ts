import { AgentError } from '../../errors/agent.error.ts';

/** A janela de contexto do modelo nao comporta nem o resumo minimo do anexo. */
export class ContextTooSmallForAttachmentError extends AgentError {
  public constructor() {
    super('ATTACHMENT_CONTEXT_TOO_SMALL', 'janela do modelo insuficiente para o anexo');
  }
}
