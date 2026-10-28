import { hasMoneyFigure } from '../../agent/summary/has.money.figure.ts';
import { MAX_TEXT_LENGTH, MIN_TEXT_LENGTH } from '../lifecycle/constants.ts';
import { isGuardedPolicy } from './is.guarded.policy.ts';
import { isSensitiveTopic } from './is.sensitive.topic.ts';
import { isTooVague } from './is.too.vague.ts';

/** Motivo de recusar o texto de uma preferencia (spec 032). */
export type PreferenceTextProblem = 'policy' | 'sensitive' | 'invalid' | 'vague';

/**
 * Valida o texto de uma preferencia por codigo (constituicao VI), na ordem: configuracao
 * (autonomia/privacidade, FR-009) > dado sensivel (FR-008) > formato (3 a 200 caracteres, sem link
 * nem valor em reais) > vaga. `null` = pode gravar.
 */
export function checkPreferenceText(rawText: string): PreferenceTextProblem | null {
  const text = rawText.trim();
  if (isGuardedPolicy(text)) return 'policy';
  if (isSensitiveTopic(text)) return 'sensitive';
  if (text.length < MIN_TEXT_LENGTH || text.length > MAX_TEXT_LENGTH || /https?:\/\//i.test(text) || hasMoneyFigure(text)) return 'invalid';
  if (isTooVague(text)) return 'vague';
  return null;
}
