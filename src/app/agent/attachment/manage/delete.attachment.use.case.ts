import { z } from 'zod';
import { InvalidInputError } from '../../../shared/invalid.input.error.ts';
import { type AgentStorePort } from '../../ports/store/agent.store.port.ts';
import { markAttachmentsUnavailable } from './mark.attachments.unavailable.ts';

const idSchema = z.string().trim().min(1).max(100);
const oneSchema = z.object({ userId: idSchema, attachmentId: idSchema });
const conversationSchema = z.object({ userId: idSchema, conversationId: idSchema });
const allSchema = z.object({ userId: idSchema });

function parse<T>(schema: z.ZodType<T>, what: string, raw: unknown): T {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const flat = z.flattenError(parsed.error);
    throw new InvalidInputError(what, flat.fieldErrors as Record<string, string[]>, flat.formErrors);
  }
  return parsed.data;
}

/** Apaga UM anexo ja enviado: some do disco e a parte da mensagem vira "Anexo apagado" (spec 036, FR-013). So o dono; sem erro se ja nao existe. */
export class DeleteAttachmentUseCase {
  private readonly store: AgentStorePort;

  public constructor(store: AgentStorePort) {
    this.store = store;
  }

  public async execute(rawInput: unknown): Promise<void> {
    const { userId, attachmentId } = parse(oneSchema, 'apagar anexo', rawInput);
    const found = await this.store.attachments.get(userId, attachmentId);
    if (found === null) return;
    await this.store.attachments.delete(userId, attachmentId);
    await markAttachmentsUnavailable(this.store, userId, found.conversationId, new Set([attachmentId]));
  }
}

/** Apaga todos os anexos de UMA conversa; as mensagens ficam e mostram "Anexo apagado". Devolve quantos. */
export class DeleteConversationAttachmentsUseCase {
  private readonly store: AgentStorePort;

  public constructor(store: AgentStorePort) {
    this.store = store;
  }

  public async execute(rawInput: unknown): Promise<{ removed: number }> {
    const { userId, conversationId } = parse(conversationSchema, 'apagar anexos da conversa', rawInput);
    const ids = new Set((await this.store.attachments.listByConversation(userId, conversationId)).map((a) => a.id));
    const removed = await this.store.attachments.deleteByConversation(userId, conversationId);
    await markAttachmentsUnavailable(this.store, userId, conversationId, ids);
    return { removed };
  }
}

/** Apaga todos os anexos do usuario (Privacidade › Anexos › Apagar todos). Devolve quantos. */
export class DeleteAllAttachmentsUseCase {
  private readonly store: AgentStorePort;

  public constructor(store: AgentStorePort) {
    this.store = store;
  }

  public async execute(rawInput: unknown): Promise<{ removed: number }> {
    const { userId } = parse(allSchema, 'apagar todos os anexos', rawInput);
    const conversations = await this.store.conversations.list(userId, { limit: 100_000 });
    const perConversation: { id: string; ids: Set<string> }[] = [];
    for (const c of conversations) perConversation.push({ id: c.id, ids: new Set((await this.store.attachments.listByConversation(userId, c.id)).map((a) => a.id)) });
    const removed = await this.store.attachments.deleteAll(userId);
    for (const c of perConversation) await markAttachmentsUnavailable(this.store, userId, c.id, c.ids);
    return { removed };
  }
}
