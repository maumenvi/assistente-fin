import { type ProviderId } from '../../../domain/agent/provider/provider.id.ts';

/** Provedor como a tela simples o mostra (so dados; nada de funcao). */
export interface ProviderOption {
  readonly id: ProviderId;
  readonly label: string;
  readonly tagline: string;
  readonly chip: string;
  readonly needsKey: boolean;
  readonly keyLabel: string;
  /** Modelo padrao exibido antes do teste (o teste pode trocar por um que passe na sonda). */
  readonly defaultModel: string | null;
  readonly disabledReason: 'local_only' | null;
}
