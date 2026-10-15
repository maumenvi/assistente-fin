import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CreateCardPaymentUseCase } from '../../../src/app/transaction/create.card.payment.use.case.ts';
import { GetMonthlyForecastUseCase } from '../../../src/app/forecast/get.monthly.forecast.use.case.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { Transaction } from '../../../src/domain/transaction/transaction.entity.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

const NOW = new Date('2026-01-01T00:00:00.000Z');

/**
 * Teste de regressao do ciclo completo (spec 018, RF-27, criterio de aceite 6 - equivalente a
 * tarefa D3 prevista no `.tasks.md` da spec 016): compra no cartao (mes N) -> fechamento da
 * fatura -> pagamento via `CreateCardPaymentUseCase` -> forecast do mes N e do mes N+1.
 *
 * Depende de F1 (018, RF-27a - despesa de conta-cartao nao conta duas vezes na categoria) e
 * F2 (018, RF-26 - forecast exclui pela flag/grupo da transacao) ja implementadas: sem elas,
 * este teste falharia por causas diferentes das que pretende provar.
 */
const setup = async () => {
  const database = new FakeDatabase();
  const ids = new SequentialIdGenerator('id');

  const user = User.create({
    id: 'u1',
    cpf: Cpf.create('52998224725'),
    email: Email.create('marco@exemplo.com'),
    phone: Phone.create('11987654321'),
    name: 'Marco',
    createdAt: NOW,
  }).verifyEmail(NOW).verifyPhone(NOW);
  await database.users.save(user);

  await database.accounts.save(
    Account.create({
      id: 'checking1',
      userId: 'u1',
      name: 'Conta corrente',
      kind: 'checking',
      openingBalance: Money.zero(),
    }),
  );
  await database.accounts.save(
    Account.create({
      id: 'card1',
      userId: 'u1',
      name: 'Cartao',
      kind: 'credit-card',
      openingBalance: Money.zero(),
      creditLimit: Money.fromCents(1_000_000),
      closingDay: 25,
      dueDay: 10,
    }),
  );

  const createCardPayment = new CreateCardPaymentUseCase(database, ids);
  const getMonthlyForecast = new GetMonthlyForecastUseCase(
    database.users,
    database.incomes,
    database.fixedExpenses,
    database.spendingLimits,
    database.transactions,
    database.accounts,
    database.categories,
  );

  return { database, createCardPayment, getMonthlyForecast };
};

test('compra no cartao -> pagamento de fatura -> forecast: despesa conta exatamente 1x, baixa nunca vira ganho, fatura paga nao volta no mes seguinte (spec 018, RF-27)', async () => {
  const { database, createCardPayment, getMonthlyForecast } = await setup();

  // fechamento 25/mar, vencimento 10/abr (dueDay <= closingDay -> mes seguinte) -> periodo de
  // apuracao [26/fev, 24/mar] (mesmo cenario ja usado nos testes de get.monthly.forecast)
  await database.transactions.save(
    Transaction.create({
      id: 't-compra-mercado',
      userId: 'u1',
      date: new Date('2026-03-20T00:00:00.000Z'),
      amount: Money.fromCents(45_000),
      type: 'expense',
      categoryId: 'cat-mercado',
      accountId: 'card1',
    }),
  );

  // Passo 1: forecast do mes de vencimento (abril) ANTES do pagamento - a compra ja conta via
  // projectedCreditCardInvoices, nunca tambem na media movel de categoria (RF-27a, F1).
  const beforePayment = await getMonthlyForecast.execute({ userId: 'u1', month: { year: 2026, month: 4 } });
  assert.equal(beforePayment.projectedCreditCardInvoices.cents, 45_000);
  assert.equal(
    beforePayment.categories.find((c) => c.categoryId === 'cat-mercado'),
    undefined,
    'a compra no cartao nao deveria aparecer como categoria projetada',
  );

  // Passo 2: paga a fatura em abril (dentro do mes de vencimento).
  const payment = await createCardPayment.execute({
    userId: 'u1',
    payingAccountId: 'checking1',
    cardAccountId: 'card1',
    amountCents: 45_000,
    date: '2026-04-08T00:00:00.000Z',
  });
  assert.equal(payment.outgoing.type, 'expense');
  assert.equal(payment.incoming.type, 'income');
  assert.equal(payment.outgoing.cardPaymentGroupId, payment.incoming.cardPaymentGroupId);

  // Passo 3: forecast do mes do pagamento (abril) DEPOIS de pago - a perna de baixa
  // (type: income na conta-cartao) nunca aparece como ganho real (RF-26, F2); a fatura
  // continua contando exatamente 1x (via projectedCreditCardInvoices, calculado sobre a
  // COMPRA original, nao sobre o pagamento).
  const afterPayment = await getMonthlyForecast.execute({ userId: 'u1', month: { year: 2026, month: 4 } });
  assert.equal(afterPayment.projectedCreditCardInvoices.cents, 45_000);
  assert.equal(
    afterPayment.projectedIncome.cents,
    0,
    'a baixa de divida no cartao nunca deveria contar como ganho real',
  );
  assert.equal(
    afterPayment.categories.find((c) => c.categoryId === 'cat-mercado'),
    undefined,
    'a compra no cartao continua fora da media movel de categoria mesmo depois do pagamento',
  );
  // a perna de saida do pagamento (conta corrente, categoria de sistema isSystemCardPayment)
  // tambem nao deveria virar despesa operacional nova - RF-26 exclui pelo cardPaymentGroupId
  assert.equal(
    afterPayment.categories.find((c) => c.categoryId === payment.outgoing.categoryId),
    undefined,
    'a perna de pagamento (categoria de sistema) nao deveria aparecer como categoria projetada',
  );

  // Passo 4: forecast do mes seguinte (maio) - a fatura de marco (ja fechada e paga) nao
  // volta a aparecer como despesa operacional projetada; uma nova projecao por tendencia de
  // categoria para o mes seguinte, se a categoria tiver historico recorrente, e comportamento
  // aceitavel do forecast (confirmado com o usuario) - NAO e o que este teste verifica.
  const nextMonth = await getMonthlyForecast.execute({ userId: 'u1', month: { year: 2026, month: 5 } });
  assert.equal(
    nextMonth.projectedCreditCardInvoices.cents,
    0,
    'a fatura de marco, ja vencida em abril, nao deveria aparecer de novo em maio',
  );
});
