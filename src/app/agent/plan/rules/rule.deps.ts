import { type Clock } from '../../../shared/clock.port.ts';
import { type Database } from '../../../shared/database.port.ts';
import { type IdGenerator } from '../../../shared/id.generator.port.ts';

/** O que as regras de categorizacao precisam: banco (regras, evidencias, recusas, categorias), relogio e ids. */
export interface RuleDeps {
  readonly db: Database;
  readonly clock: Clock;
  readonly ids: IdGenerator;
}

export const DAY_MS = 86_400_000;

/** Chave da recusa lembrada de uma sugestao de regra (mesma tabela das recusas da spec 032). */
export function ruleSuppressionKey(merchant: string, categoryId: string): string {
  return `rule:${merchant}:${categoryId}`;
}
