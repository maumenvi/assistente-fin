import { type AgentSettings } from '../ports/settings/agent.settings.ts';
import { type AgentSettingsView } from './agent.settings.view.ts';

/** Converte a configuracao guardada na visao da tela: troca `keyRef` por `hasKey`. */
export function toAgentSettingsView(settings: AgentSettings, hasKey: (keyRef: string) => boolean): AgentSettingsView {
  return {
    profiles: settings.profiles.map(({ keyRef, ...rest }) => ({ ...rest, hasKey: keyRef !== null && hasKey(keyRef) })),
    localOnly: settings.localOnly,
    limits: settings.limits,
    ...(settings.routingStrategy !== undefined ? { routingStrategy: settings.routingStrategy } : {}),
  };
}
