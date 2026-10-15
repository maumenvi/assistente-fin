/**
 * O registro em edicao mudou desde que o rascunho comecou? (spec 024, FR-022): `deleted` se ele
 * nao existe mais, `changed` se a versao (`updatedAt`) e outra, `same` se continua igual.
 */
export function draftVersionStatus(recordVersion: string | null, current: { readonly updatedAt: string | null } | null): 'same' | 'changed' | 'deleted' {
  if (current === null) return 'deleted';
  return current.updatedAt === recordVersion ? 'same' : 'changed';
}
