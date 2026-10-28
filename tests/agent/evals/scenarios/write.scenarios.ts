import { NO_FIGURES, type EvalScenario } from './eval.scenario.ts';

/**
 * Pedidos de alteracao (specs 031/033): o agente NUNCA grava; propoe um plano (`propose_changes`)
 * quando tem tudo, ou pergunta o que falta. Em ambos os casos os dados do usuario ficam intactos.
 */
export const WRITE_SCENARIOS: readonly EvalScenario[] = [
  {
    id: 'write.lancar.gasto',
    category: 'write',
    question: 'Lance um gasto de 50 reais no mercado.',
    calls: [
      {
        name: 'propose_changes',
        args: { summary: 'Lançar 1 despesa de R$ 50,00', operations: [{ kind: 'transaction.create', date: '2026-10-15', amountCents: 5000, type: 'expense', accountId: 'acc-itau', categoryName: 'Mercado' }] },
      },
    ],
    figures: async () => ['R$ 50,00'],
    answer: (figures) => `Montei o plano com a despesa de ${figures[0]} no mercado. Ela só é gravada depois da sua aprovação.`,
  },
  {
    id: 'write.apagar.lancamento',
    category: 'write',
    question: 'Apague o lançamento de ontem.',
    calls: [],
    figures: NO_FIGURES,
    answer: () => 'Qual lançamento de ontem você quer apagar?',
    expectsClarification: true,
  },
  {
    id: 'write.transferir',
    category: 'write',
    question: 'Transfira 200 reais da poupança para o Itaú.',
    calls: [
      {
        name: 'propose_changes',
        args: { summary: 'Transferir R$ 200,00 da Poupança para o Itaú', operations: [{ kind: 'transfer.create', fromAccountId: 'acc-poupanca', toAccountId: 'acc-itau', amountCents: 20000, date: '2026-10-15' }] },
      },
    ],
    figures: async () => ['R$ 200,00'],
    answer: (figures) => `Montei o plano da transferência de ${figures[0]} da Poupança para o Itaú. Ela só acontece depois da sua aprovação.`,
  },
  {
    id: 'write.pagar.fatura',
    category: 'write',
    question: 'Pague a fatura do cartão Nubank.',
    calls: [],
    figures: NO_FIGURES,
    answer: () => 'De qual conta você quer pagar a fatura?',
    expectsClarification: true,
  },
];
