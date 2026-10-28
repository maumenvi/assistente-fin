/**
 * Onde uma preferencia vale (spec 032, FR-001): em tudo, so numa conta ou so numa categoria.
 * `id` referencia a entidade do usuario.
 */
export type PreferenceScope =
  | { readonly kind: 'global' }
  | { readonly kind: 'account'; readonly id: string }
  | { readonly kind: 'category'; readonly id: string };
