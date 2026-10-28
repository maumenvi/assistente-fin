import { type NoticePart } from '../../../domain/agent/notice.part.ts';
import { SETTINGS_ROUTE } from '../graph/nodes/settings.route.ts';

/** Aviso "usei o modelo alternativo" (spec 035): a troca de modelo nunca e silenciosa. */
export function fallbackUsedNotice(model: string | null): NoticePart {
  const which = model === null || model === '' ? '' : ` (${model})`;
  return { type: 'notice', kind: 'fallback_used', text: `Usei o modelo alternativo${which} porque o principal falhou desta vez.`, action: { label: 'Ver configuração', route: SETTINGS_ROUTE } };
}
