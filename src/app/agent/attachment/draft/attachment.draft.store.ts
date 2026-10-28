import { ATTACHMENT_LIMITS } from '../../../../domain/agent/attachment/attachment.limits.ts';
import { AttachmentTooLargeError } from '../../../../domain/agent/attachment/errors/attachment.too.large.error.ts';
import { DraftNotFoundError } from '../../../../domain/agent/attachment/errors/draft.not.found.error.ts';
import { type Clock } from '../../../shared/clock.port.ts';
import { type AttachmentDraft } from './attachment.draft.ts';

/** Validade de um rascunho: 1 hora. */
export const DRAFT_TTL_MS = 60 * 60 * 1000;

/** Rascunho a guardar: o armazenamento define `expiresAt`. */
export type NewAttachmentDraft = Omit<AttachmentDraft, 'expiresAt'>;

/**
 * Rascunhos de anexo em memoria (spec 036): isolados por usuario, ate 5 por usuario e 20 MB somados, com validade de 1 hora.
 * Um rascunho "preso" (`pin`) a um envio pendente (offline) nao expira. Nunca grava em disco.
 */
export class AttachmentDraftStore {
  private readonly clock: Clock;
  private readonly drafts = new Map<string, AttachmentDraft>();
  private readonly pinned = new Set<string>();

  public constructor(clock: Clock) {
    this.clock = clock;
  }

  /** Guarda um rascunho; recusa o que passar de 5 anexos ou 20 MB por usuario. */
  public put(draft: NewAttachmentDraft): AttachmentDraft {
    this.sweep();
    const mine = this.listOf(draft.userId);
    if (mine.length >= ATTACHMENT_LIMITS.maxPerMessage) throw new AttachmentTooLargeError('message');
    const used = mine.reduce((sum, d) => sum + d.sizeBytes, 0);
    if (used + draft.sizeBytes > ATTACHMENT_LIMITS.maxMessageBytes) throw new AttachmentTooLargeError('message');
    const stored: AttachmentDraft = { ...draft, expiresAt: new Date(this.clock.now().getTime() + DRAFT_TTL_MS).toISOString() };
    this.drafts.set(draft.draftId, stored);
    return stored;
  }

  /** Le um rascunho do dono; inexistente, expirado ou de outro usuario => `DraftNotFoundError`. */
  public get(userId: string, draftId: string): AttachmentDraft {
    this.sweep();
    const found = this.drafts.get(draftId);
    if (found === undefined || found.userId !== userId) throw new DraftNotFoundError();
    return found;
  }

  /** Remove um rascunho (botao Remover). Sem erro se ja nao existir. */
  public discard(userId: string, draftId: string): void {
    const found = this.drafts.get(draftId);
    if (found !== undefined && found.userId === userId) {
      this.drafts.delete(draftId);
      this.pinned.delete(draftId);
    }
  }

  /** Prende o rascunho a um envio pendente: nao expira ate ser consumido ou removido. */
  public pin(userId: string, draftId: string): void {
    this.get(userId, draftId);
    this.pinned.add(draftId);
  }

  /** Consome (le e remove) os rascunhos do envio; qualquer um inexistente => `DraftNotFoundError` e nada e consumido. */
  public take(userId: string, draftIds: readonly string[]): AttachmentDraft[] {
    const taken = draftIds.map((id) => this.get(userId, id));
    for (const id of draftIds) {
      this.drafts.delete(id);
      this.pinned.delete(id);
    }
    return taken;
  }

  /** Rascunhos do usuario (sem expirados). */
  public listOf(userId: string): AttachmentDraft[] {
    this.sweep();
    return [...this.drafts.values()].filter((d) => d.userId === userId);
  }

  /** Remove os expirados (os presos ficam). */
  public sweep(): void {
    const now = this.clock.now().getTime();
    for (const [id, draft] of this.drafts) {
      if (!this.pinned.has(id) && new Date(draft.expiresAt).getTime() <= now) this.drafts.delete(id);
    }
  }
}
