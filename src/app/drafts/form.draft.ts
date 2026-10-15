/**
 * Rascunho de um formulario nao salvo (spec 024, FR-018; data-model.md `form_draft`): o que foi
 * digitado, como foi digitado, para continuar depois que o app for fechado. So no celular - nao
 * sincroniza nem entra no backup (FR-021).
 */
export interface FormDraft {
  /** `<form>:<recordId | "novo">` - um rascunho por formulario/registro. */
  readonly key: string;
  /** Qual formulario (contracts/form-drafts.md). */
  readonly form: string;
  /** Registro em edicao; `null` = cadastro novo. */
  readonly recordId: string | null;
  /** `updatedAt` do registro quando a edicao comecou (FR-022). */
  readonly recordVersion: string | null;
  /** Valores como digitados (inclui modo e selecoes). */
  readonly values: unknown;
  readonly updatedAt: Date;
}
