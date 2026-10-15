import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Account } from '../../../src/domain/account/account.entity.ts';
import { InvalidAccountError } from '../../../src/domain/account/invalid.account.error.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';

const base = () => ({
  id: 'acc-1',
  userId: 'user-1',
  name: '  Conta Corrente  ',
  kind: 'checking' as const,
  openingBalance: Money.fromCents(10_000),
  openingBalanceDate: new Date('2026-01-01T00:00:00.000Z'),
});

test('create normaliza campos de texto e nasce nao arquivada (CA-1)', () => {
  const account = Account.create(base());

  assert.equal(account.name, 'Conta Corrente');
  assert.equal(account.userId, 'user-1');
  assert.equal(account.archived, false);
  assert.equal(account.openingBalance.cents, 10_000);
});

test('create nasce com isBenefit false por padrao, para qualquer kind (spec 011, RF-9a)', () => {
  assert.equal(Account.create(base()).isBenefit, false);
  assert.equal(Account.create({ ...base(), kind: 'credit-card' }).isBenefit, false);
  assert.equal(Account.create({ ...base(), kind: 'savings' }).isBenefit, false);
});

test('create aceita isBenefit true explicito', () => {
  const account = Account.create({ ...base(), isBenefit: true });
  assert.equal(account.isBenefit, true);
});

test('changeBenefitFlag alterna a marcacao imutavelmente, para qualquer kind (spec 011, RF-9)', () => {
  for (const kind of ['checking', 'savings', 'credit-card'] as const) {
    const account = Account.create({ ...base(), kind });

    const marked = account.changeBenefitFlag(true);
    assert.equal(marked.isBenefit, true);
    assert.equal(account.isBenefit, false, 'imutavel');

    const unmarked = marked.changeBenefitFlag(false);
    assert.equal(unmarked.isBenefit, false);
    assert.equal(marked.isBenefit, true, 'imutavel');
  }
});

test('create rejeita campos obrigatorios vazios e tipo invalido', () => {
  assert.throws(() => Account.create({ ...base(), id: '  ' }), InvalidAccountError);
  assert.throws(() => Account.create({ ...base(), userId: '' }), InvalidAccountError);
  assert.throws(() => Account.create({ ...base(), name: '   ' }), InvalidAccountError);
  assert.throws(
    () => Account.create({ ...base(), name: 'x'.repeat(121) }),
    InvalidAccountError,
  );
  assert.throws(
    // @ts-expect-error tipo invalido de proposito
    () => Account.create({ ...base(), kind: 'poupanca' }),
    InvalidAccountError,
  );
});

test('create exige openingBalanceDate quando o saldo e diferente de zero', () => {
  assert.throws(
    () => Account.create({ ...base(), openingBalanceDate: null }),
    InvalidAccountError,
  );
  const { openingBalanceDate: _omitted, ...withoutDate } = base();
  assert.throws(() => Account.create(withoutDate), InvalidAccountError);
});

test('create com saldo zero nao exige openingBalanceDate', () => {
  const account = Account.create({
    ...base(),
    openingBalance: Money.zero(),
    openingBalanceDate: null,
  });
  assert.equal(account.openingBalanceDate, null);
});

test('openingBalanceDate persiste e e exposta pela entidade', () => {
  const date = new Date('2026-09-17T00:00:00.000Z');
  const account = Account.create({ ...base(), openingBalanceDate: date });
  assert.equal(account.openingBalanceDate?.getTime(), date.getTime());
});

test('transicoes sao imutaveis', () => {
  const account = Account.create(base());

  const renamed = account.rename('Nubank');
  assert.equal(renamed.name, 'Nubank');
  assert.equal(account.name, 'Conta Corrente');

  const archived = account.archive();
  assert.equal(archived.archived, true);
  assert.equal(account.archived, false);
  assert.equal(archived.archive(), archived, 'archive e idempotente');

  const rebalanced = account.changeOpeningBalance(Money.fromCents(-500), new Date('2026-01-01T00:00:00.000Z'));
  assert.equal(rebalanced.openingBalance.cents, -500);
  assert.equal(account.openingBalance.cents, 10_000);

  assert.throws(() => account.rename(''), InvalidAccountError);
});

test('fromPersistence reconstroi preservando archived (adaptadores de database/)', () => {
  const account = Account.fromPersistence({ ...base(), name: 'Ja Persistida', archived: true });

  assert.equal(account.name, 'Ja Persistida');
  assert.equal(account.archived, true);
});

test('fromPersistence reaplica as mesmas invariantes de create (defesa em profundidade)', () => {
  assert.throws(
    () => Account.fromPersistence({ ...base(), id: '', archived: false }),
    InvalidAccountError,
  );
});

test('conta credit-card aceita creditLimit/closingDay/dueDay validos e diferentes (spec 008 revisao, RF-1, RF-2)', () => {
  const account = Account.create({
    ...base(),
    kind: 'credit-card',
    creditLimit: Money.fromCents(500_000),
    closingDay: 20,
    dueDay: 10,
  });

  assert.equal(account.creditLimit?.cents, 500_000);
  assert.equal(account.closingDay, 20);
  assert.equal(account.dueDay, 10);
});

test('conta credit-card sem creditLimit/closingDay/dueDay e aceita (nao retroage a contas existentes)', () => {
  const account = Account.create({ ...base(), kind: 'credit-card' });

  assert.equal(account.creditLimit, null);
  assert.equal(account.closingDay, null);
  assert.equal(account.dueDay, null);
});

test('conta credit-card rejeita dueDay fora de 1..31', () => {
  assert.throws(
    () => Account.create({ ...base(), kind: 'credit-card', creditLimit: Money.zero(), dueDay: 0 }),
    InvalidAccountError,
  );
  assert.throws(
    () => Account.create({ ...base(), kind: 'credit-card', creditLimit: Money.zero(), dueDay: 32 }),
    InvalidAccountError,
  );
});

test('conta credit-card rejeita closingDay fora de 1..31', () => {
  assert.throws(
    () => Account.create({ ...base(), kind: 'credit-card', creditLimit: Money.zero(), closingDay: 0 }),
    InvalidAccountError,
  );
  assert.throws(
    () => Account.create({ ...base(), kind: 'credit-card', creditLimit: Money.zero(), closingDay: 32 }),
    InvalidAccountError,
  );
});

test('conta credit-card rejeita closingDay igual a dueDay (spec 008 revisao, regra nova)', () => {
  assert.throws(
    () =>
      Account.create({
        ...base(),
        kind: 'credit-card',
        creditLimit: Money.zero(),
        closingDay: 10,
        dueDay: 10,
      }),
    InvalidAccountError,
  );
});

test('conta de outro kind com creditLimit, closingDay ou dueDay informado e rejeitada (RF-3)', () => {
  assert.throws(
    () => Account.create({ ...base(), kind: 'checking', creditLimit: Money.fromCents(1_000) }),
    InvalidAccountError,
  );
  assert.throws(
    () => Account.create({ ...base(), kind: 'checking', closingDay: 5 }),
    InvalidAccountError,
  );
  assert.throws(
    () => Account.create({ ...base(), kind: 'checking', dueDay: 5 }),
    InvalidAccountError,
  );
});

test('changeCreditCardTerms atualiza limite, fechamento e vencimento de uma conta credit-card', () => {
  const account = Account.create({ ...base(), kind: 'credit-card' });

  const updated = account.changeCreditCardTerms(Money.fromCents(200_000), 20, 15);

  assert.equal(updated.creditLimit?.cents, 200_000);
  assert.equal(updated.closingDay, 20);
  assert.equal(updated.dueDay, 15);
  assert.equal(account.creditLimit, null, 'imutavel');
});

test('changeCreditCardTerms rejeita closingDay igual a dueDay', () => {
  const account = Account.create({ ...base(), kind: 'credit-card' });

  assert.throws(
    () => account.changeCreditCardTerms(Money.fromCents(200_000), 15, 15),
    InvalidAccountError,
  );
});

test('changeCreditCardTerms em conta que nao e credit-card e rejeitado', () => {
  const account = Account.create({ ...base(), kind: 'checking' });

  assert.throws(
    () => account.changeCreditCardTerms(Money.fromCents(200_000), 20, 15),
    InvalidAccountError,
  );
});

test('changeKind troca entre tipos comuns imutavelmente', () => {
  const account = Account.create({ ...base(), kind: 'checking' });

  const changed = account.changeKind('savings');
  assert.equal(changed.kind, 'savings');
  assert.equal(account.kind, 'checking', 'imutavel');
});

test('changeKind rejeita sair de credit-card', () => {
  const account = Account.create({
    id: 'acc-1',
    userId: 'user-1',
    name: 'Cartao',
    kind: 'credit-card',
    openingBalance: Money.zero(),
  });

  assert.throws(() => account.changeKind('checking'), InvalidAccountError);
});

test('changeKind rejeita entrar em credit-card', () => {
  const account = Account.create({ ...base(), kind: 'checking' });

  assert.throws(() => account.changeKind('credit-card'), InvalidAccountError);
});
