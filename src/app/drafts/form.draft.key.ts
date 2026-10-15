/** Chave do rascunho (spec 024): um por formulario e registro - `<form>:<recordId | "novo">`. */
export function formDraftKey(form: string, recordId: string | null): string {
  return `${form}:${recordId ?? 'novo'}`;
}
