import { type ModelCapabilities } from '../../../../domain/agent/model.capabilities.ts';
import { type ModelOrigin } from '../../../../domain/agent/model.origin.ts';
import { type ModelRole } from '../../../../domain/agent/model.role.ts';

/** Endereco padrao de cada origem de modelo. */
export const DEFAULT_BASE_URL: Readonly<Record<ModelOrigin, string>> = {
  openrouter: 'https://openrouter.ai/api/v1',
  google: 'https://generativelanguage.googleapis.com/v1beta/openai',
  openai_compat_local: 'http://localhost:11434/v1',
};

/** Perfil de um papel como o formulario o edita. */
export interface ProfileForm {
  readonly role: ModelRole;
  /** O id do perfil e o proprio papel (`main`, `fast`, `fallback`): estavel entre salvamentos. */
  readonly id: ModelRole;
  readonly origin: ModelOrigin;
  readonly baseUrl: string;
  readonly model: string;
  /** Chave digitada agora; vazia = manter a guardada (ou nenhuma). Nunca preenchida com a chave real. */
  readonly apiKey: string;
  /** Ja existe chave guardada (so o fato, nunca o valor). */
  readonly hasKey: boolean;
  /** Capacidades verificadas no ultimo teste de conexao. */
  readonly capabilities: ModelCapabilities | null;
}

/** Formulario em branco de um papel: OpenRouter, sem modelo. */
export function emptyProfileForm(role: ModelRole): ProfileForm {
  return { role, id: role, origin: 'openrouter', baseUrl: DEFAULT_BASE_URL.openrouter, model: '', apiKey: '', hasKey: false, capabilities: null };
}

/** Um perfil esta configurado quando tem modelo escolhido. */
export function isProfileConfigured(form: ProfileForm): boolean {
  return form.model.trim() !== '';
}
