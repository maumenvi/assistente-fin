import { PathOutsideGrantError } from '../errors/path.outside.grant.error.ts';

/**
 * O caminho que o modelo pediu precisa ser absoluto (ou `~/...`, expandido com `home`) e sem `..` (spec 040, FR-011).
 * Devolve o caminho absoluto; qualquer outra forma lanca `PathOutsideGrantError`.
 */
export function assertPlainPath(path: string, home: string): string {
  const slashed = path.trim().replace(/\\/g, '/');
  const expanded = slashed === '~' ? home : slashed.startsWith('~/') ? `${home.replace(/\/+$/, '')}/${slashed.slice(2)}` : slashed;
  if (!expanded.startsWith('/') || expanded.split('/').includes('..') || expanded.includes('\0')) throw new PathOutsideGrantError();
  return expanded;
}
