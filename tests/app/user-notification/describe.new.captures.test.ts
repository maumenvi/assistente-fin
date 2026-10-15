import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeNewCaptures } from '../../../src/app/user-notification/describe.new.captures.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';

test('nenhuma captura -> null', () => {
  assert.equal(describeNewCaptures([]), null);
});

test('uma captura com valor e descricao', () => {
  assert.deepEqual(describeNewCaptures([{ amountCents: 4290, description: 'Mercado' }]), {
    title: 'Captura do celular',
    message: `${Money.fromCents(4290).format()} — Mercado`,
  });
});

test('uma captura so com valor', () => {
  assert.deepEqual(describeNewCaptures([{ amountCents: 4290, description: null }]), {
    title: 'Captura do celular',
    message: Money.fromCents(4290).format(),
  });
});

test('uma captura so com descricao', () => {
  assert.deepEqual(describeNewCaptures([{ amountCents: null, description: 'Padaria' }]), {
    title: 'Captura do celular',
    message: 'Padaria',
  });
});

test('uma captura sem valor nem descricao', () => {
  assert.deepEqual(describeNewCaptures([{ amountCents: null, description: null }]), {
    title: 'Captura do celular',
    message: 'Nova captura para revisar',
  });
});

test('varias capturas -> so a contagem', () => {
  const captures = [
    { amountCents: 100, description: 'A' },
    { amountCents: null, description: null },
    { amountCents: 300, description: null },
  ];
  assert.deepEqual(describeNewCaptures(captures), {
    title: 'Capturas do celular',
    message: '3 novas capturas do celular para revisar',
  });
});
