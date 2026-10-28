import { formatBrl } from '../../../../src/app/agent/verify/format.brl.ts';
import { EVAL_NOW, type EvalDataset } from '../dataset/eval.dataset.ts';
import { type WriteScenario } from './write.scenario.ts';

const TODAY = EVAL_NOW.toISOString().slice(0, 10);
const br = (iso: string): string => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

async function latestMercado(ds: EvalDataset) {
  const rows = (await ds.db.transactions.listByUser(ds.userId)).filter((t) => t.categoryId === 'cat-mercado' && t.type === 'expense' && t.installmentGroupId === null && t.seriesId === null && t.transferGroupId === null);
  const row = rows[0];
  if (row === undefined) throw new Error('a base sintetica nao tem lancamento simples de mercado');
  return row;
}

async function simpleExpense(ds: EvalDataset) {
  const rows = (await ds.db.transactions.listByUser(ds.userId)).filter((t) => t.type === 'expense' && t.accountId === 'acc-itau' && t.installmentGroupId === null && t.seriesId === null && t.transferGroupId === null);
  const row = rows[0];
  if (row === undefined) throw new Error('a base sintetica nao tem despesa simples no Itau');
  return row;
}

const plan = (summary: string, operations: readonly Record<string, unknown>[]) => ({ summary, operations });

export const WRITE_EVAL_SCENARIOS: readonly WriteScenario[] = [
  {
    id: 'lancar.despesa',
    question: 'Lance R$ 87,50 de mercado hoje na conta Itaú.',
    propose: () => Promise.resolve(plan('Lançar 1 despesa de R$ 87,50', [{ kind: 'transaction.create', date: TODAY, amountCents: 8750, type: 'expense', accountId: 'acc-itau', categoryName: 'Mercado' }])),
    expect: () => Promise.resolve({ type: 'plan', flags: [], items: [{ kind: 'transaction.create', fields: { amountCents: 8750, type: 'expense', accountId: 'acc-itau', date: TODAY } }] }),
  },
  {
    id: 'registrar.ganho',
    question: 'Registre um ganho de R$ 1.500,00 de Freela na Carteira, hoje.',
    propose: () => Promise.resolve(plan('Registrar ganho de R$ 1.500,00', [{ kind: 'income.create', date: TODAY, amountCents: 150_000, source: 'Freela', accountId: 'acc-carteira' }])),
    expect: () => Promise.resolve({ type: 'plan', flags: [], items: [{ kind: 'income.create', fields: { amountCents: 150_000, source: 'Freela', accountId: 'acc-carteira' } }] }),
  },
  {
    id: 'lote.classificar',
    question: 'Classifique as 3 compras mais recentes de Mercado como Lazer.',
    propose: async (ds) => {
      const rows = (await ds.db.transactions.listByUser(ds.userId)).filter((t) => t.categoryId === 'cat-mercado' && t.type === 'expense' && t.installmentGroupId === null && t.seriesId === null && t.transferGroupId === null).slice(0, 3);
      return plan('Classificar 3 lançamentos como Lazer', rows.map((t) => ({ kind: 'transaction.categorize', id: t.id, categoryId: 'cat-lazer' })));
    },
    expect: async (ds) => {
      const rows = (await ds.db.transactions.listByUser(ds.userId)).filter((t) => t.categoryId === 'cat-mercado' && t.type === 'expense' && t.installmentGroupId === null && t.seriesId === null && t.transferGroupId === null).slice(0, 3);
      return { type: 'plan', flags: [], items: rows.map((t) => ({ kind: 'transaction.categorize', fields: { id: t.id, categoryId: 'cat-lazer' } })) };
    },
  },
  {
    id: 'duplicata',
    question: async (ds) => {
      const t = await simpleExpense(ds);
      return `Lance um gasto de ${formatBrl(t.amount.cents)} em ${br(t.date.toISOString().slice(0, 10))} na conta Itaú.`;
    },
    propose: async (ds) => {
      const t = await simpleExpense(ds);
      return plan('Lançar 1 despesa', [{ kind: 'transaction.create', date: t.date.toISOString().slice(0, 10), amountCents: t.amount.cents, type: 'expense', accountId: 'acc-itau', categoryId: t.categoryId }]);
    },
    expect: async (ds) => {
      const t = await simpleExpense(ds);
      return { type: 'plan', flags: ['duplicate'], items: [{ kind: 'transaction.create', fields: { amountCents: t.amount.cents, accountId: 'acc-itau' } }] };
    },
  },
  {
    id: 'cartao.estoura',
    question: 'Lance uma compra de R$ 9.000,00 no cartão Iti hoje.',
    propose: () => Promise.resolve(plan('Lançar compra de R$ 9.000,00 no Iti', [{ kind: 'transaction.create', date: TODAY, amountCents: 900_000, type: 'expense', accountId: 'card-iti', categoryName: 'Lazer' }])),
    expect: () => Promise.resolve({ type: 'plan', flags: ['limit_impact'], items: [{ kind: 'transaction.create', fields: { amountCents: 900_000, accountId: 'card-iti' } }] }),
  },
  {
    id: 'conta.faltando',
    question: 'Lance um gasto de R$ 30,00 no mercado.',
    propose: null,
    expect: () => Promise.resolve({ type: 'question' }),
  },
  {
    id: 'excluir',
    question: 'Apague o lançamento mais recente de Mercado.',
    propose: async (ds) => plan('Excluir 1 lançamento', [{ kind: 'transaction.delete', id: (await latestMercado(ds)).id }]),
    expect: async (ds) => ({ type: 'plan', flags: [], items: [{ kind: 'transaction.delete', fields: { id: (await latestMercado(ds)).id } }] }),
  },
  {
    id: 'transferir',
    question: 'Transfira R$ 200,00 da Poupança para o Itaú hoje.',
    propose: () => Promise.resolve(plan('Transferir R$ 200,00', [{ kind: 'transfer.create', fromAccountId: 'acc-poupanca', toAccountId: 'acc-itau', amountCents: 20_000, date: TODAY }])),
    expect: () => Promise.resolve({ type: 'plan', flags: [], items: [{ kind: 'transfer.create', fields: { amountCents: 20_000, fromAccountId: 'acc-poupanca', toAccountId: 'acc-itau' } }] }),
  },
  {
    id: 'pagar.fatura',
    question: 'Pague R$ 500,00 da fatura do Nubank com a conta Itaú, hoje.',
    propose: () => Promise.resolve(plan('Pagar fatura de R$ 500,00', [{ kind: 'cardPayment.create', payingAccountId: 'acc-itau', cardAccountId: 'card-nubank', amountCents: 50_000, date: TODAY }])),
    expect: () => Promise.resolve({ type: 'plan', flags: [], items: [{ kind: 'cardPayment.create', fields: { amountCents: 50_000, payingAccountId: 'acc-itau', cardAccountId: 'card-nubank' } }] }),
  },
  {
    id: 'renomear.categoria',
    question: 'Renomeie a categoria Lazer para Diversão.',
    propose: () => Promise.resolve(plan('Renomear categoria', [{ kind: 'category.rename', id: 'cat-lazer', name: 'Diversão' }])),
    expect: () => Promise.resolve({ type: 'plan', flags: [], items: [{ kind: 'category.rename', fields: { id: 'cat-lazer', name: 'Diversão' } }] }),
  },
  {
    id: 'corrigir.valor',
    question: 'Corrija o valor do lançamento mais recente de Mercado para R$ 100,00.',
    propose: async (ds) => plan('Corrigir valor para R$ 100,00', [{ kind: 'transaction.update', id: (await latestMercado(ds)).id, amountCents: 10_000 }]),
    expect: async (ds) => ({ type: 'plan', flags: [], items: [{ kind: 'transaction.update', fields: { id: (await latestMercado(ds)).id, amountCents: 10_000 } }] }),
  },
  {
    id: 'gasto.fixo',
    question: 'Cadastre um gasto fixo de R$ 99,90 de Internet, vence dia 5, na conta Itaú.',
    propose: () => Promise.resolve(plan('Cadastrar gasto fixo de R$ 99,90', [{ kind: 'fixedExpense.create', dueDay: 5, expectedAmountCents: 9990, accountId: 'acc-itau', description: 'Internet' }])),
    expect: () => Promise.resolve({ type: 'plan', flags: [], items: [{ kind: 'fixedExpense.create', fields: { expectedAmountCents: 9990, dueDay: 5, accountId: 'acc-itau' } }] }),
  },
];
