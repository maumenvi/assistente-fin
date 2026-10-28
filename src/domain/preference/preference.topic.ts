/** Topicos conhecidos; definem o efeito e detectam conflito (spec 032, research P2). */
export const PREFERENCE_TOPICS = [
  'response_length',
  'tone',
  'format',
  'show_account',
  'show_installment',
  'number_style',
  'default_account',
  'default_period',
  'auto_category',
] as const;

/** Topico conhecido ou livre (`other:<slug>`, nunca entra em conflito automatico). */
export type PreferenceTopic = (typeof PREFERENCE_TOPICS)[number] | `other:${string}`;
