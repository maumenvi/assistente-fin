import { PathOutsideGrantError } from '../errors/path.outside.grant.error.ts';
import { accessCovers, type FolderAccess } from './folder.access.ts';
import { type FolderGrant } from './folder.grant.ts';
import { isInside } from './is.inside.ts';
import { normalizePath } from './normalize.path.ts';

/**
 * Acha a concessao que cobre `path` para o `access` pedido (spec 040, FR-010/011). Recebe o caminho
 * ja resolvido pelo adaptador (`realpath`, que desfaz links simbolicos); caminho relativo ou com `..`
 * e recusado com `PathOutsideGrantError`. `null` = nenhuma concessao cobre (o chat deve perguntar).
 */
export function resolveWithinGrant(path: string, grants: readonly FolderGrant[], access: FolderAccess): FolderGrant | null {
  const slashed = path.replace(/\\/g, '/');
  if (!slashed.startsWith('/') || slashed.split('/').includes('..')) throw new PathOutsideGrantError();
  const target = normalizePath(slashed);
  return grants.find((grant) => isInside(normalizePath(grant.path), target) && accessCovers(grant.access, access)) ?? null;
}
