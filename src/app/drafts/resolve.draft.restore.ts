import { type FormDraft } from './form.draft.ts';
import { type DraftRestore } from './draft.restore.ts';

/**
 * Decide a restauracao (spec 024, FR-019; research R10): sem rascunho, nada; valores que o
 * formulario nao reconhece mais (mudou de forma numa atualizacao) -> `invalid`, para apagar sem
 * quebrar a tela; senao, restaura. `parse` e o zod de rascunho do formulario, na borda.
 */
export function resolveDraftRestore<T>(draft: FormDraft | null, parse: (values: unknown) => T | null): DraftRestore<T> {
  if (draft === null) return { kind: 'none' };
  const values = parse(draft.values);
  if (values === null) return { kind: 'invalid' };
  return { kind: 'restore', values, updatedAt: draft.updatedAt };
}
