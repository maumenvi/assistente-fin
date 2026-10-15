import { type FormDraft } from './form.draft.ts';

/** Onde ficam os rascunhos de formulario (spec 024, FR-018-FR-021): SQLite cifrado do celular. */
export interface FormDraftStore {
  /** Grava ou substitui pela chave. */
  save(draft: FormDraft): Promise<void>;
  find(key: string): Promise<FormDraft | null>;
  /** O mais recente (reabrir ao abrir o app). */
  latest(): Promise<FormDraft | null>;
  /** O mais recente de um formulario (editores embutidos: um aberto por vez). */
  latestOf(form: string): Promise<FormDraft | null>;
  remove(key: string): Promise<void>;
  /** Despareamento, troca de usuario, importacao de backup, primeiro uso (FR-020). */
  clearAll(): Promise<void>;
}
