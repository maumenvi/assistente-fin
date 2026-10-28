import { type ProviderId } from '../../../domain/agent/provider/provider.id.ts';
import { type AgentSettingsView } from '../settings/agent.settings.view.ts';
import { type ProviderOption } from './provider.option.ts';

/** Estado da tela simples (spec 035, contracts/setup.ipc.md). Nunca carrega a chave: so `hasKey`. */
export interface SetupView {
  /** Provedor do perfil principal; sem perfil, o recomendado. `custom` = servidor proprio (so no Avancado). */
  readonly provider: ProviderId | 'custom';
  readonly providers: readonly ProviderOption[];
  /** Modelo do perfil principal (`null` = ainda nao configurado). */
  readonly model: string | null;
  /** O modelo nao e o padrao do provedor ("Modelo: X (personalizado)"). */
  readonly isCustomModel: boolean;
  readonly hasKey: boolean;
  readonly configured: boolean;
  readonly localOnly: boolean;
  readonly consentGiven: boolean;
  readonly advanced: AgentSettingsView;
}
