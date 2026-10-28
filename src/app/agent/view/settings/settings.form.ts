import { type ModelRole } from '../../../../domain/agent/model.role.ts';
import { type AgentSettingsInput } from '../../ports/settings/agent.settings.input.ts';
import { type ModelProfileInput } from '../../ports/settings/model.profile.input.ts';
import { type AgentSettingsView } from '../../settings/agent.settings.view.ts';
import { defaultLimitsForm, limitsFormFromBudget, parseLimitsForm, type LimitsForm } from './limits.form.ts';
import { emptyProfileForm, isProfileConfigured, type ProfileForm } from './profile.form.ts';

/** Papeis na ordem em que a tela os mostra. */
export const FORM_ROLES: readonly ModelRole[] = ['main', 'fast', 'fallback'];

/** Tela de configuracao dos modelos: um formulario por papel + privacidade + limites. */
export interface SettingsForm {
  readonly profiles: Readonly<Record<ModelRole, ProfileForm>>;
  readonly localOnly: boolean;
  readonly limits: LimitsForm;
}

/** Formulario de quem ainda nao configurou nada. */
export function emptySettingsForm(): SettingsForm {
  return {
    profiles: { main: emptyProfileForm('main'), fast: emptyProfileForm('fast'), fallback: emptyProfileForm('fallback') },
    localOnly: false,
    limits: defaultLimitsForm(),
  };
}

/** Configuracao guardada (visao sem chave) -> formulario. */
export function settingsFormFromView(view: AgentSettingsView): SettingsForm {
  const form = emptySettingsForm();
  const profiles = { ...form.profiles };
  for (const p of view.profiles) {
    profiles[p.role] = {
      role: p.role,
      id: p.role,
      origin: p.origin,
      baseUrl: p.baseUrl,
      model: p.model,
      apiKey: '',
      hasKey: p.hasKey,
      capabilities: p.capabilities.verifiedAt === null ? null : p.capabilities,
    };
  }
  return { profiles, localOnly: view.localOnly, limits: limitsFormFromBudget(view.limits) };
}

/** Resultado de montar a entrada de salvar. */
export type SettingsInputResult =
  | { readonly ok: true; readonly input: AgentSettingsInput }
  | { readonly ok: false; readonly errors: readonly string[]; readonly needsNoToolsConfirm?: true; readonly noToolsModel?: string };

const ROLE_NAME: Readonly<Record<ModelRole, string>> = { main: 'Principal', fast: 'Rápido', fallback: 'Alternativo' };

/**
 * Formulario -> entrada de `ConfigureModels.set`: so os papeis com modelo escolhido entram; o
 * principal e obrigatorio; a chave so vai se foi digitada. Erros em pt-BR para a tela.
 */
export function buildSettingsInput(form: SettingsForm, options: { readonly allowLocal: boolean; readonly confirmNoTools?: boolean }): SettingsInputResult {
  const errors: string[] = [];
  // spec 035 (FR-010): um principal que o teste mostrou SEM ferramentas so e salvo com confirmacao explicita
  const main = form.profiles.main;
  if (isProfileConfigured(main) && main.capabilities !== null && !main.capabilities.tools && options.confirmNoTools !== true) {
    return { ok: false, errors: [`O modelo ${main.model.trim()} não consulta os seus dados: o assistente só conseguiria conversar. Escolha outro ou confirme para salvar mesmo assim.`], needsNoToolsConfirm: true, noToolsModel: main.model.trim() };
  }
  const profiles: ModelProfileInput[] = [];
  for (const role of FORM_ROLES) {
    const p = form.profiles[role];
    if (!isProfileConfigured(p)) {
      if (role === 'main') errors.push('Escolha o modelo principal.');
      continue;
    }
    if (p.origin === 'openai_compat_local' && !options.allowLocal) errors.push(`${ROLE_NAME[role]}: modelos locais só existem no computador.`);
    if (p.baseUrl.trim() === '') errors.push(`${ROLE_NAME[role]}: informe o endereço do servidor.`);
    profiles.push({
      id: p.id,
      role,
      origin: p.origin,
      baseUrl: p.baseUrl.trim(),
      model: p.model.trim(),
      enabled: true,
      ...(p.apiKey.trim() === '' ? {} : { apiKey: p.apiKey.trim() }),
    });
  }
  const limits = parseLimitsForm(form.limits);
  if (!limits.ok) errors.push(...limits.errors);
  if (errors.length > 0 || !limits.ok) return { ok: false, errors };
  return { ok: true, input: { profiles, localOnly: form.localOnly, limits: limits.budget } };
}
