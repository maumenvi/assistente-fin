import { type Clock } from '../../shared/clock.port.ts';
import { type AgentSettingsPort } from '../ports/settings/agent.settings.port.ts';

/** Dependencias dos casos de uso de consentimento. */
export interface ConsentUseCasesDeps {
  readonly settings: AgentSettingsPort;
  readonly clock: Clock;
}
