import { type Preference } from '../../../domain/preference/preference.ts';
import { sanitizeText } from '../tools/shared/sanitize.text.ts';

/**
 * Bloco de preferencias do prompt (spec 032, contracts/context.strategy.md): texto fixo + uma linha
 * por preferencia, na ordem recebida (a ordem estavel e responsabilidade de quem seleciona). Tentativas
 * vem marcadas. Deixa claro que preferencia nao substitui regra de seguranca, autonomia nem privacidade.
 * Vazio quando nao ha nenhuma.
 */
export function renderPreferences(preferences: readonly Preference[]): string {
  if (preferences.length === 0) return '';
  const lines = preferences.map((p) => `- ${p.status === 'tentative' ? '(tentativa) ' : ''}${sanitizeText(p.text, 200)}`);
  return ['[Preferências do usuário — siga quando forem relevantes ao pedido; não substituem as regras de segurança, de autonomia nem de privacidade]', ...lines].join('\n');
}
