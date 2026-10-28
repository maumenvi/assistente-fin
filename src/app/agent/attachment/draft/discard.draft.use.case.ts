import { type AttachmentDraftStore } from './attachment.draft.store.ts';

/** Remove um rascunho de anexo (botao Remover / cancelar leitura); sem erro se ele ja nao existir. */
export class DiscardDraftUseCase {
  private readonly drafts: AttachmentDraftStore;

  public constructor(drafts: AttachmentDraftStore) {
    this.drafts = drafts;
  }

  public execute(input: { readonly userId: string; readonly draftId: string }): void {
    this.drafts.discard(input.userId, input.draftId);
  }
}
