import { type Attachment } from '../../../../domain/agent/attachment/attachment.ts';

/** Totais de anexos de um usuario (cartao Privacidade › Anexos). */
export interface AttachmentStats {
  readonly count: number;
  readonly totalBytes: number;
}

/**
 * Armazenamento local dos anexos (spec 036, data-model.md 6), exposto como `Database.agent.attachments`. Toda leitura e
 * escrita filtra por `userId`: um usuario nunca enxerga o anexo de outro. Fora do backup e da sincronizacao.
 */
export interface AttachmentStorePort {
  save(attachment: Attachment): Promise<void>;
  get(userId: string, id: string): Promise<Attachment | null>;
  listByMessage(userId: string, messageId: string): Promise<Attachment[]>;
  listByConversation(userId: string, conversationId: string): Promise<Attachment[]>;
  /** Apaga um anexo; devolve se existia. */
  delete(userId: string, id: string): Promise<boolean>;
  /** Apaga todos os anexos de uma conversa; devolve quantos. */
  deleteByConversation(userId: string, conversationId: string): Promise<number>;
  /** Apaga todos os anexos do usuario; devolve quantos. */
  deleteAll(userId: string): Promise<number>;
  stats(userId: string): Promise<AttachmentStats>;
}
