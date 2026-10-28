import { type ProviderDefinition } from './provider.definition.ts';

/** Provedor oferecido na tela; `disabledReason` explica por que nao da para escolher agora. */
export interface ProviderChoice {
  readonly provider: ProviderDefinition;
  readonly disabledReason: 'local_only' | null;
}
