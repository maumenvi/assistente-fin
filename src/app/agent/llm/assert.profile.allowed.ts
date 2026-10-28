import { type ConsentRecord } from '../../../domain/agent/consent.record.ts';
import { ConsentRequiredError } from '../../../domain/agent/errors/consent.required.error.ts';
import { LocalOnlyViolationError } from '../../../domain/agent/errors/local.only.violation.error.ts';
import { type ModelProfile } from '../../../domain/agent/model.profile.ts';
import { requiresCloudConsent } from '../../../domain/agent/requires.cloud.consent.ts';

/**
 * Regras de privacidade de um perfil, ANTES de qualquer segredo ou requisicao: "somente local" com
 * perfil de nuvem -> `LocalOnlyViolationError` (FR-028); nuvem sem consentimento vigente ->
 * `ConsentRequiredError` (FR-027). Perfil local nunca exige consentimento.
 */
export function assertProfileAllowed(
  profile: ModelProfile,
  rules: { readonly localOnly: boolean; readonly consent: ConsentRecord | null; readonly consentTextVersion: string },
): void {
  if (!requiresCloudConsent(profile.origin)) return;
  if (rules.localOnly) throw new LocalOnlyViolationError();
  if (rules.consent?.textVersion !== rules.consentTextVersion) throw new ConsentRequiredError();
}
