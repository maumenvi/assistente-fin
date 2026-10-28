import { type Preference } from '../../../../domain/preference/preference.ts';
import { sanitizeText } from '../../tools/shared/sanitize.text.ts';

const STATE_LABEL: Readonly<Record<Preference['status'], string>> = { active: 'ativa', tentative: 'tentativa', candidate: 'candidata', disabled: 'desativada' };

/** Linha curta de uma preferencia, igual ao que a tela mostra (spec 032, FR-011). `scopeLabel` ja vem resolvido. */
export function describePreference(p: Preference, scopeLabel: string): string {
  const origin = p.origin === 'said' ? 'dita por você' : 'aprendida';
  const privacy = p.private ? 'privada' : 'pode ir à nuvem';
  return `- [${STATE_LABEL[p.status]}] ${sanitizeText(p.text, 200)} (${scopeLabel}; ${origin}; ${privacy}) id=${p.id}`;
}
