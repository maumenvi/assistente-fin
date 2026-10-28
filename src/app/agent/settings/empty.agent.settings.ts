import { DEFAULT_RUN_BUDGET } from '../../../domain/agent/default.run.budget.ts';
import { type AgentSettings } from '../ports/settings/agent.settings.ts';

/** Configuracao de quem ainda nao configurou nada: sem perfis, nuvem permitida, limites padrao. */
export function emptyAgentSettings(): AgentSettings {
  return { profiles: [], localOnly: false, limits: { ...DEFAULT_RUN_BUDGET } };
}
