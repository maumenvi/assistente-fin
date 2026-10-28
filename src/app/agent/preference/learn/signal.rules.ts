import { type PreferenceTopic } from '../../../../domain/preference/preference.topic.ts';

/** Regra do catalogo pt-BR: padrao (sobre o texto normalizado) -> chave do sinal e candidata que ele sustenta. */
export interface StyleRule {
  readonly pattern: RegExp;
  /** `topico:valor` (ex.: `response_length:short`). */
  readonly key: string;
  readonly topic: PreferenceTopic;
  /** Texto-padrao da candidata (o modelo rapido pode refinar so a redacao). */
  readonly text: string;
}

/**
 * Catalogo de feedback de estilo (spec 032, contracts/learning.md): dados, nao logica. Os padroes
 * rodam sobre o texto normalizado (minusculo, sem acento nem pontuacao). Para adicionar um gosto novo
 * basta uma linha aqui e um teste em `signal.rules.test.ts`.
 */
export const STYLE_RULES: readonly StyleRule[] = [
  { pattern: /\b(mais )?(curt[oa]s?|resumid[oa]s?|objetiv[oa]s?|breves?|direto|diretos)\b|\bsem enrolacao\b|\bmenos texto\b|\bresuma\b/, key: 'response_length:short', topic: 'response_length', text: 'Responder de forma curta.' },
  { pattern: /\b(mais )?detalhad[oa]s?\b|\bmais detalhes?\b|\bexplique melhor\b|\baprofunde\b|\bresposta completa\b/, key: 'response_length:long', topic: 'response_length', text: 'Responder de forma detalhada.' },
  { pattern: /\bsem emojis?\b|\bnao use emojis?\b|\btire os emojis?\b/, key: 'format:no_emoji', topic: 'format', text: 'Não usar emojis.' },
  { pattern: /\b(em|numa|na) tabela\b|\bmonte uma tabela\b/, key: 'format:table', topic: 'format', text: 'Apresentar listas em tabela.' },
  { pattern: /\bmostre (tambem )?a conta\b|\bem qual conta\b|\bqual era a conta\b/, key: 'show_account:yes', topic: 'show_account', text: 'Mostrar a conta ao lado dos valores.' },
  { pattern: /\bmostre (tambem )?a parcela\b|\bem quantas parcelas\b|\bqual era a parcela\b/, key: 'show_installment:yes', topic: 'show_installment', text: 'Mostrar a parcela nos gastos do cartão.' },
  { pattern: /\bmais informal\b|\btom informal\b|\bfale mais solto\b/, key: 'tone:informal', topic: 'tone', text: 'Usar um tom informal.' },
  { pattern: /\bmais formal\b|\btom formal\b|\bfale mais formal\b/, key: 'tone:formal', topic: 'tone', text: 'Usar um tom formal.' },
];
