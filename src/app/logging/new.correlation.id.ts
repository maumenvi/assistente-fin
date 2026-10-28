import { type IdGenerator } from '../shared/id.generator.port.ts';

/** Gera um novo id de correlacao reaproveitando o `IdGenerator` da aplicacao (spec 017). */
export function newCorrelationId(ids: IdGenerator): string {
  return ids.next();
}
