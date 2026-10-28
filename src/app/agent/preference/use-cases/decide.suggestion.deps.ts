import { type Clock } from '../../../shared/clock.port.ts';
import { type AgentStorePort } from '../../ports/store/agent.store.port.ts';
import { type PreferenceStoresPort } from '../../ports/preference/preference.stores.port.ts';

/** O que confirmar/recusar uma sugestao precisa (spec 032). */
export interface DecideSuggestionDeps {
  readonly stores: PreferenceStoresPort;
  readonly store: AgentStorePort;
  readonly clock: Clock;
}
