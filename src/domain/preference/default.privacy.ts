import { type PreferenceScope } from './preference.scope.ts';

/**
 * Privacidade padrao (clarificacao 2026-10-22): estilo/formato globais podem ir a modelos da
 * nuvem; preferencia de conta ou categoria nasce privada ate o usuario liberar.
 */
export function defaultPrivate(scope: PreferenceScope): boolean {
  return scope.kind !== 'global';
}
