import { LocalOnlyViolationError } from '../../../domain/agent/errors/local.only.violation.error.ts';
import { NoModelConfiguredError } from '../../../domain/agent/errors/no.model.configured.error.ts';
import { type ConsentRecord } from '../../../domain/agent/consent.record.ts';
import { type ModelProfile } from '../../../domain/agent/model.profile.ts';
import { type LlmPort } from '../ports/llm/llm.port.ts';
import { type AgentSettings } from '../ports/settings/agent.settings.ts';
import { assertProfileAllowed } from './assert.profile.allowed.ts';
import { type RoleLlms } from './role.llms.ts';

/** Monta o `LlmPort` de um perfil (o `createLlmPort` na producao, um fake nos testes). */
export type MakeLlm = (profile: ModelProfile) => Promise<LlmPort>;

/**
 * Escolhe e monta os modelos das tres funcoes (spec 031, FR-020/FR-021/FR-028). O principal e
 * obrigatorio: sem ele, `NoModelConfiguredError`; com privacidade violada, o erro correspondente
 * - tudo ANTES de qualquer requisicao. Rapido e alternativo sao opcionais; os que violam o modo
 * "somente local" ficam inativos em vez de derrubar a execucao.
 */
export async function buildRoleLlms(
  settings: AgentSettings,
  consent: ConsentRecord | null,
  consentTextVersion: string,
  makeLlm: MakeLlm,
): Promise<RoleLlms> {
  const rules = { localOnly: settings.localOnly, consent, consentTextVersion };
  const active = (role: ModelProfile['role']): ModelProfile | undefined => settings.profiles.find((p) => p.role === role && p.enabled);

  const mainProfile = active('main');
  if (mainProfile === undefined) throw new NoModelConfiguredError();
  assertProfileAllowed(mainProfile, rules);
  const main = await makeLlm(mainProfile);

  const optional = async (profile: ModelProfile | undefined): Promise<LlmPort | null> => {
    if (profile === undefined) return null;
    try {
      assertProfileAllowed(profile, rules);
    } catch (error) {
      if (error instanceof LocalOnlyViolationError) return null;
      throw error;
    }
    return makeLlm(profile);
  };
  const fastProfile = active('fast') ?? null;
  const fast = await optional(fastProfile ?? undefined);
  const fallbackProfile = active('fallback');
  const fallback = await optional(fallbackProfile);
  return {
    main,
    fast: fast ?? undefined,
    fallback,
    mainProfile,
    fastProfile: fast === null ? null : fastProfile,
    fallbackProfile: fallback === null ? null : (fallbackProfile ?? null),
  };
}
