import { type ModelOrigin } from '../model.origin.ts';
import { DEFAULT_MODEL_PRICING, FALLBACK_CLOUD_PRICING, LOCAL_ZERO_PRICING } from './default.model.pricing.ts';
import { type ModelPricing } from './model.pricing.ts';

/**
 * Resolve a tabela de precos por 1M de tokens de um modelo (spec 038, contracts/routing.and.pricing.md):
 * 1. Se `custom` foi configurado pelo usuario, usa `custom`.
 * 2. Se `origin === 'openai_compat_local'` (ex.: Ollama), retorna custo zero (`LOCAL_ZERO_PRICING`).
 * 3. Procura o identificador do modelo em `DEFAULT_MODEL_PRICING`; se nao achar, retorna `FALLBACK_CLOUD_PRICING`.
 */
export function resolveModelPricing(
  origin: ModelOrigin,
  model: string,
  custom?: ModelPricing | null,
): ModelPricing {
  if (custom !== undefined && custom !== null) return custom;
  if (origin === 'openai_compat_local') return LOCAL_ZERO_PRICING;
  const normalized = model.trim().toLowerCase();
  const entry = DEFAULT_MODEL_PRICING.find((item) => normalized.includes(item.match));
  return entry?.pricing ?? FALLBACK_CLOUD_PRICING;
}

