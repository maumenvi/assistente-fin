import { isInside } from './is.inside.ts';
import { normalizePath } from './normalize.path.ts';

/** Onde ficam os dados sensiveis do app e do usuario (a lista de proibidos depende da maquina). */
export interface DenyContext {
  readonly home: string;
  readonly userData: string;
}

const SYSTEM_ROOTS = ['/proc', '/sys', '/dev'] as const;

/**
 * Caminhos que o assistente nunca acessa, mesmo com pasta autorizada por cima (spec 040, FR-011): dados do
 * proprio app, chaves (`~/.ssh`, `~/.gnupg`), arquivos `.env*` e pseudo-sistemas do Linux.
 */
export function isDeniedPath(path: string, context: DenyContext): boolean {
  const target = normalizePath(path);
  const home = normalizePath(context.home);
  const roots = [normalizePath(context.userData), `${home}/.ssh`, `${home}/.gnupg`, ...SYSTEM_ROOTS];
  if (roots.some((root) => isInside(root, target))) return true;
  return target.split('/').some((segment) => /^\.env(\..*)?$/i.test(segment));
}
