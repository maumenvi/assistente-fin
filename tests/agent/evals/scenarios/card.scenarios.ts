import { brl, cardStatus } from '../dataset/dataset.facts.ts';
import { type EvalScenario } from './eval.scenario.ts';

const CARDS: readonly (readonly [string, string])[] = [['card-nubank', 'Nubank'], ['card-iti', 'Iti']];

const invoice: EvalScenario[] = CARDS.map(([id, name]) => ({
  id: `card.fatura.${id}`,
  category: 'card',
  question: `Quanto está a fatura do cartão ${name}?`,
  calls: [{ name: 'get_credit_card_status', args: { accountId: id } }],
  figures: async (ds) => [brl((await cardStatus(ds, id)).invoice)],
  answer: ([value]) => `A fatura do cartão ${name} está em ${value}.`,
}));

const limit: EvalScenario[] = CARDS.map(([id, name]) => ({
  id: `card.limite.${id}`,
  category: 'card',
  question: `Qual o limite disponível do cartão ${name}?`,
  calls: [{ name: 'get_credit_card_status', args: { accountId: id } }],
  figures: async (ds) => [brl((await cardStatus(ds, id)).available)],
  answer: ([value]) => `O limite disponível do cartão ${name} é ${value}.`,
}));

const committed: EvalScenario[] = CARDS.map(([id, name]) => ({
  id: `card.comprometido.${id}`,
  category: 'card',
  question: `Quanto tenho comprometido em parcelas futuras no cartão ${name}?`,
  calls: [{ name: 'get_credit_card_status', args: { accountId: id } }],
  figures: async (ds) => [brl((await cardStatus(ds, id)).committed)],
  answer: ([value]) => `No cartão ${name} há ${value} comprometidos em parcelas futuras.`,
}));

export const CARD_SCENARIOS: readonly EvalScenario[] = [...invoice, ...limit, ...committed];
