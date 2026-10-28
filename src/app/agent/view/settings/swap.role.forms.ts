import { type ModelRole } from '../../../../domain/agent/model.role.ts';
import { type SettingsForm } from './settings.form.ts';
import { isProfileConfigured, type ProfileForm } from './profile.form.ts';

/** Resultado de trocar dois papeis de lugar. */
export interface SwapResult {
  readonly form: SettingsForm;
  /** Aviso para a tela (a chave nao acompanha a troca, troca recusada...); `null` quando nada a dizer. */
  readonly notice: string | null;
}

const ROLE_NAME: Readonly<Record<ModelRole, string>> = { main: 'Principal', fast: 'Rápido', fallback: 'Alternativo' };

/** Conteudo de um papel (tudo, menos `role`/`id`, que pertencem ao lugar). */
function content(form: ProfileForm): Omit<ProfileForm, 'role' | 'id'> {
  const { role: _role, id: _id, ...rest } = form;
  return rest;
}

/**
 * Troca qual modelo ocupa cada papel (arrastar na tela). A chave guardada fica presa ao papel: se os dois lados usam a mesma
 * origem (mesma chave) a troca e limpa; se as origens diferem, a chave nao acompanha o modelo e a tela avisa para digitar de novo.
 * O principal nunca fica vazio.
 */
export function swapRoleForms(form: SettingsForm, a: ModelRole, b: ModelRole): SwapResult {
  if (a === b) return { form, notice: null };
  const left = form.profiles[a];
  const right = form.profiles[b];
  if ((a === 'main' && !isProfileConfigured(right)) || (b === 'main' && !isProfileConfigured(left))) {
    return { form, notice: 'O modelo principal é obrigatório: escolha um modelo para o papel que ficaria vazio antes de trocar.' };
  }
  const sameKey = left.origin === right.origin;
  const moved = (from: ProfileForm, to: ModelRole): ProfileForm => ({ ...content(from), role: to, id: to, hasKey: sameKey ? from.hasKey : false, apiKey: from.apiKey });
  const next: SettingsForm = { ...form, profiles: { ...form.profiles, [a]: moved(right, a), [b]: moved(left, b) } };
  const lostKey = !sameKey && ((left.hasKey && left.apiKey === '') || (right.hasKey && right.apiKey === ''));
  return { form: next, notice: lostKey ? `${ROLE_NAME[a]} e ${ROLE_NAME[b]} usam provedores diferentes: a chave não acompanha o modelo. Digite a chave de novo no papel que ficou sem ela.` : null };
}
