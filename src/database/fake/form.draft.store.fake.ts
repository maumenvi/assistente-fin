import { type FormDraft } from '../../app/drafts/form.draft.ts';
import { type FormDraftStore } from '../../app/drafts/form.draft.store.port.ts';

/** Rascunhos em memoria para testes (spec 024). */
export class FakeFormDraftStore implements FormDraftStore {
  public readonly drafts = new Map<string, FormDraft>();

  public async save(draft: FormDraft): Promise<void> {
    // como no SQLite: os valores passam por JSON (campo `undefined` some)
    this.drafts.set(draft.key, { ...draft, values: JSON.parse(JSON.stringify(draft.values ?? null)) as unknown });
  }

  public async find(key: string): Promise<FormDraft | null> {
    return this.drafts.get(key) ?? null;
  }

  public async latest(): Promise<FormDraft | null> {
    return this.newest(() => true);
  }

  public async latestOf(form: string): Promise<FormDraft | null> {
    return this.newest((draft) => draft.form === form);
  }

  private newest(match: (draft: FormDraft) => boolean): FormDraft | null {
    let newest: FormDraft | null = null;
    for (const draft of this.drafts.values()) {
      if (!match(draft)) continue;
      if (newest === null || draft.updatedAt.getTime() > newest.updatedAt.getTime()) newest = draft;
    }
    return newest;
  }

  public async remove(key: string): Promise<void> {
    this.drafts.delete(key);
  }

  public async clearAll(): Promise<void> {
    this.drafts.clear();
  }
}
