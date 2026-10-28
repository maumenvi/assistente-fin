import { type ModelProfile } from '../../../domain/agent/model.profile.ts';
import { type LlmPort } from '../ports/llm/llm.port.ts';
import { assertProfileAllowed } from './assert.profile.allowed.ts';
import { buildLlmPort } from './build.llm.port.ts';
import { type CreateLlmPortDeps } from './create.llm.port.deps.ts';

/**
 * Monta o `LlmPort` de um perfil (spec 031, T056). As verificacoes de privacidade vem ANTES de
 * qualquer segredo ou requisicao: "somente local" com perfil de nuvem -> `LocalOnlyViolationError`
 * (FR-028); nuvem sem consentimento vigente -> `ConsentRequiredError` (FR-027). Perfil local nunca
 * exige consentimento.
 */
export async function createLlmPort(profile: ModelProfile, deps: CreateLlmPortDeps): Promise<LlmPort> {
  assertProfileAllowed(profile, deps);
  return buildLlmPort(profile, deps);
}
