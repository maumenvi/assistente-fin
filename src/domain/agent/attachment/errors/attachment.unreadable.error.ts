import { AgentError } from '../../errors/agent.error.ts';

/** Motivos pelos quais um arquivo nao pode ser lido. */
export type UnreadableReason = 'corrupt' | 'empty' | 'password' | 'no_text' | 'device';

/** O arquivo nao pode ser lido (corrompido, vazio, protegido por senha, PDF sem texto ou PDF num aparelho que nao le PDF). */
export class AttachmentUnreadableError extends AgentError {
  public readonly reason: UnreadableReason;

  public constructor(reason: UnreadableReason) {
    super(`ATTACHMENT_UNREADABLE_${reason.toUpperCase()}`, `anexo ilegivel: ${reason}`);
    this.reason = reason;
  }
}
