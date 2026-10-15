/** O que fazer com o rascunho achado ao abrir o formulario (spec 024, FR-019). */
export type DraftRestore<T> =
  | { readonly kind: 'none' }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'restore'; readonly values: T; readonly updatedAt: Date };
