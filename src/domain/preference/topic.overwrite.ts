import { type PreferenceOverwrite } from './preference.overwrite.ts';

const TOPIC_PREFIX = 'topic:';

/**
 * Id do aviso de uma preferencia substituida por conflito de topico (spec 032, research P2). Reusa
 * `PreferenceOverwrite` (aviso discreto + "Restaurar"): o prefixo distingue de uma sobrescrita por
 * edicao simultanea nos dois aparelhos, cujo id e `preferencia@instante`.
 */
export function topicOverwriteId(loserId: string): string {
  return `${TOPIC_PREFIX}${loserId}`;
}

/** O aviso veio de um conflito de topico (duas preferencias contraditorias), nao de edicao simultanea? */
export function isTopicOverwrite(overwrite: PreferenceOverwrite): boolean {
  return overwrite.id.startsWith(TOPIC_PREFIX);
}
