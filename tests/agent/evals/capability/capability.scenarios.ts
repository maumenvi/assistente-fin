import { type CapabilityScenario } from './capability.scenario.ts';

/** 10 cenarios de lacuna -> busca -> cartao (gabarito do catalogo curado do app). */
export const CAPABILITY_SCENARIOS: readonly CapabilityScenario[] = [
  { id: 'capability.01', question: 'Quanto dá US$ 120,00 em reais hoje?', expected: 'cambio', query: 'converter dólar em reais' },
  { id: 'capability.02', question: 'Qual a cotação do euro agora?', expected: 'cambio', query: 'cotação do euro' },
  { id: 'capability.03', question: 'Converta 50 dólares para real, por favor', expected: 'cambio', query: 'converter dólar' },
  { id: 'capability.04', question: 'Preciso converter moedas para a minha viagem', expected: 'cambio', query: 'converter moedas' },
  { id: 'capability.05', question: 'Qual o câmbio do dólar hoje?', expected: 'cambio', query: 'câmbio do dólar' },
  { id: 'capability.06', question: 'Me ajude a planejar a minha aposentadoria', expected: 'planejamento-aposentadoria', query: 'planejamento de aposentadoria' },
  { id: 'capability.07', question: 'Quanto devo guardar por mês para a previdência?', expected: 'planejamento-aposentadoria', query: 'previdência aposentadoria planejamento' },
  { id: 'capability.08', question: 'Qual o preço do ouro hoje em grama?', expected: 'none', query: 'preço do ouro' },
  { id: 'capability.09', question: 'Quanto está o aluguel de carros em Lisboa?', expected: 'none', query: 'aluguel de carros em Lisboa' },
  { id: 'capability.10', question: 'Qual a previsão do tempo para amanhã?', expected: 'not_applicable' },
];
