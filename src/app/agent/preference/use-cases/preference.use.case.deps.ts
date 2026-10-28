import { type Clock } from '../../../shared/clock.port.ts';
import { type PreferenceStoresPort } from '../../ports/preference/preference.stores.port.ts';
import { type MemoryEntities } from '../memory.context.ts';

/** O que os casos de uso de preferencias precisam (spec 032). */
export interface PreferenceUseCaseDeps {
  readonly stores: PreferenceStoresPort;
  readonly clock: Clock;
  /** Contas e categorias do usuario, para validar o escopo ao editar. */
  entities(userId: string): Promise<MemoryEntities>;
}
