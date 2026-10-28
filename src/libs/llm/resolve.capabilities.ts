import { CONSERVATIVE_CAPABILITIES } from '../../domain/agent/conservative.capabilities.ts';
import { type ModelCapabilities } from '../../domain/agent/model.capabilities.ts';
import { presetCapabilities } from './capability.presets.ts';

/** Fontes de capacidade, da mais forte para a mais fraca (spec 031, D6). */
export interface CapabilitySources {
  readonly modelId: string;
  /** Escolha explicita do usuario. */
  readonly override?: Partial<ModelCapabilities>;
  /** Resultado da sonda de ferramentas. */
  readonly probe?: Partial<ModelCapabilities>;
  /** Metadados do `GET /models`. */
  readonly listing?: Partial<ModelCapabilities>;
}

/**
 * Resolve as capacidades de um modelo: override do usuario > sonda > `/models` > presets por
 * familia > conservador (sem ferramentas, contexto pequeno). Cada camada so sobrescreve os campos
 * que traz.
 */
export function resolveCapabilities(sources: CapabilitySources): ModelCapabilities {
  return {
    ...CONSERVATIVE_CAPABILITIES,
    ...presetCapabilities(sources.modelId),
    ...sources.listing,
    ...sources.probe,
    ...sources.override,
  };
}
