import { isTopicOverwrite } from '../../../../domain/preference/topic.overwrite.ts';
import { type Preference } from '../../../../domain/preference/preference.ts';
import { type PreferenceOverwrite } from '../../../../domain/preference/preference.overwrite.ts';

/** Aviso discreto de substituicao, com a acao "Desfazer" (spec 032, US1 cenario 4 e FR-010). */
export interface ConflictNoticeView {
  readonly id: string;
  readonly kind: 'topic' | 'device';
  readonly text: string;
  /** Rotulo do botao que restaura o texto perdido. */
  readonly undoLabel: string;
}

/**
 * Avisos a mostrar: conflito de topico ("Substitui X por Y, mais recente") e edicao simultanea nos
 * dois aparelhos ("alterada em outro aparelho"). Avisos cuja preferencia nao existe mais somem.
 */
export function buildConflictNotices(notices: readonly PreferenceOverwrite[], preferences: readonly Preference[]): ConflictNoticeView[] {
  const out: ConflictNoticeView[] = [];
  for (const notice of notices) {
    const current = preferences.find((p) => p.id === notice.preferenceId);
    if (current === undefined) continue;
    if (isTopicOverwrite(notice)) {
      out.push({ id: notice.id, kind: 'topic', text: `Você disse "${current.text}" depois de "${notice.lostText}". Mantive a mais recente e desativei a outra.`, undoLabel: 'Desfazer' });
    } else {
      out.push({ id: notice.id, kind: 'device', text: `Esta preferência foi alterada em outro aparelho. Sua versão era "${notice.lostText}".`, undoLabel: 'Restaurar a minha' });
    }
  }
  return out;
}
