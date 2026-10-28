import { type PreferenceStoresPort } from '../ports/preference/preference.stores.port.ts';
import { type NamedEntity } from '../../../domain/preference/select/select.context.ts';

/** Contas e categorias do usuario, para casar o escopo de uma preferencia pelo nome. */
export interface MemoryEntities {
  readonly accounts: readonly NamedEntity[];
  readonly categories: readonly NamedEntity[];
}

/**
 * O que o agente enxerga da memoria de preferencias (spec 032): o armazenamento, as entidades do
 * usuario e as preferencias aplicadas na resposta anterior ("esqueca isso" sem alvo).
 */
export interface MemoryContext {
  readonly stores: PreferenceStoresPort;
  entities(userId: string): Promise<MemoryEntities>;
  lastAppliedIds(userId: string, conversationId: string): Promise<readonly string[]>;
}
