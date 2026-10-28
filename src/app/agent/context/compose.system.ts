import { type ConversationSummary } from '../../../domain/agent/summary/conversation.summary.ts';
import { type Preference } from '../../../domain/preference/preference.ts';
import { renderPreferences } from './render.preferences.ts';
import { renderSummary } from './render.summary.ts';

/**
 * Prompt de sistema completo (spec 032, spec 037 T038/T039): base -> instrucao do modo (se houver) ->
 * preferencias -> indice de capacidades (spec 034) -> resumo + combinados fixos -> ancora da ultima consulta.
 */
export function composeSystem(
  base: string,
  extras: {
    readonly mode?: string | undefined;
    readonly preferences: readonly Preference[];
    readonly summary: ConversationSummary | null;
    readonly capabilities?: string | undefined;
    readonly pinnedConstraints?: readonly string[] | undefined;
    readonly lastQueryAnchor?: string | undefined;
  },
): string {
  return [
    base,
    extras.mode ?? '',
    renderPreferences(extras.preferences),
    extras.capabilities ?? '',
    renderSummary(extras.summary, extras.pinnedConstraints ?? []),
    extras.lastQueryAnchor ?? '',
  ]
    .filter((block) => block !== '')
    .join('\n\n');
}
