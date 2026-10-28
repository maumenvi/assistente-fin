import { type ModelOrigin } from './model.origin.ts';

/** Verdadeiro quando enviar uma pergunta a este tipo de modelo exige o consentimento de nuvem (FR-027). */
export function requiresCloudConsent(origin: ModelOrigin): boolean {
  return origin !== 'openai_compat_local';
}
