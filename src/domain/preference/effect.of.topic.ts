import { type PreferenceEffect } from './preference.effect.ts';
import { type PreferenceScope } from './preference.scope.ts';
import { type PreferenceTopic } from './preference.topic.ts';

const DATA_TOPICS: readonly string[] = ['default_account', 'default_period', 'auto_category'];

/**
 * Efeito derivado do topico, nao do texto livre (spec 032, research P5): conta padrao, periodo
 * padrao e categoria automatica afetam dados; `other:*` e estilo no escopo global e dado quando
 * ligado a uma conta ou categoria.
 */
export function effectOfTopic(topic: PreferenceTopic, scope: PreferenceScope): PreferenceEffect {
  if (DATA_TOPICS.includes(topic)) return 'data';
  if (topic.startsWith('other:')) return scope.kind === 'global' ? 'style' : 'data';
  return 'style';
}
