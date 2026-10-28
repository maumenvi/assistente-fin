import { type ModelCapabilities } from './model.capabilities.ts';
import { type ModelOrigin } from './model.origin.ts';
import { type ModelRole } from './model.role.ts';
import { type ModelPricing } from './pricing/model.pricing.ts';
import { type RunBudget } from './run.budget.ts';

/**
 * Perfil de um modelo configurado (spec 031, data-model.md 1; spec 038, data-model.md 1).
 * Nao guarda a chave de API: so `keyRef`, uma referencia ao segredo no cofre. Um perfil
 * `openai_compat_local` nunca exige chave.
 */
export interface ModelProfile {
  readonly id: string;
  readonly role: ModelRole;
  readonly origin: ModelOrigin;
  /** Padrao `https://openrouter.ai/api/v1`; local, `http://localhost:11434/v1`. */
  readonly baseUrl: string;
  /** Identificador do modelo no provedor. */
  readonly model: string;
  readonly keyRef: string | null;
  readonly capabilities: ModelCapabilities;
  readonly enabled: boolean;
  /** Limites especificos desta LLM (sobrescreve o limite global se definido). */
  readonly limits?: RunBudget | undefined;
  /** Preco customizado por 1M tokens (sobrescreve a tabela de mercado se definido). */
  readonly pricing?: ModelPricing | null | undefined;
}

/**
 * Perfil de modelo exportado para sincronização com o celular (spec 039, FR-007).
 * Apenas origens em nuvem ('google' e 'openrouter') são sincronizáveis; perfis locais nunca vão ao mobile.
 */
export interface SyncAgentModelProfile {
  readonly id: string;
  readonly role: ModelRole;
  readonly origin: 'google' | 'openrouter';
  readonly baseUrl: string;
  readonly model: string;
  readonly apiKey?: string | undefined;
  readonly enabled: boolean;
  readonly updatedAt?: string | undefined;
}
