import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PreRegistration } from '../../../src/domain/pre-registration/pre.registration.entity.ts';
import { Money } from '../../../src/domain/shared/money.value.object.ts';
import { markLegacyWalletDuplicates } from '../../../src/domain/pre-registration/mark.legacy.wallet.duplicates.ts';

const at = (min: number) => new Date(Date.UTC(2026, 9, 1, 12, min));
const wallet = (id: string, cents: number, description: string | null, min: number, extra = {}) =>
  PreRegistration.create({ id, userId: 'u1', origin: 'wallet', createdAt: at(min), amount: Money.fromCents(cents), ...(description ? { description } : {}), ...extra });

test('caso do incidente: 3 compras x 2 -> 3 marcas, cada uma apontando para a primeira', () => {
  const pending = [
    wallet('a1', 4290, 'Mercado Dia', 0),
    wallet('a2', 4290, 'mercado dia', 0),
    wallet('b1', 1200, 'Padaria São João', 5),
    wallet('b2', 1200, 'Padaria Sao Joao', 6),
    wallet('c1', 8000, null, 30),
    wallet('c2', 8000, null, 31),
  ];
  assert.deepEqual(
    markLegacyWalletDuplicates(pending).sort((x, y) => x.id.localeCompare(y.id)),
    [
      { id: 'a2', possibleDuplicateOf: 'a1' },
      { id: 'b2', possibleDuplicateOf: 'b1' },
      { id: 'c2', possibleDuplicateOf: 'c1' },
    ],
  );
});

test('nao marca: valor diferente, estabelecimento diferente, mais de 10 min, outra origem, ja marcado', () => {
  const pending = [
    wallet('x1', 4290, 'Mercado', 0),
    wallet('x2', 4291, 'Mercado', 1),
    wallet('x3', 4290, 'Padaria', 1),
    wallet('x4', 4290, 'Mercado', 11),
    PreRegistration.create({ id: 'v1', userId: 'u1', origin: 'voice', createdAt: at(1), amount: Money.fromCents(4290), description: 'Mercado' }),
    wallet('x5', 4290, 'Mercado', 2, { possibleDuplicateOf: 'outro' }),
  ];
  assert.deepEqual(markLegacyWalletDuplicates(pending), []);
});

test('quem ja respondeu "sao compras diferentes" nao e remarcado nem serve de original (spec 028)', () => {
  const pending = [wallet('a1', 4290, 'Mercado Dia', 0), wallet('a2', 4290, 'Mercado Dia', 1, { duplicateReviewed: true })];
  assert.deepEqual(markLegacyWalletDuplicates(pending), []);
  assert.deepEqual(markLegacyWalletDuplicates([wallet('a1', 4290, 'Mercado Dia', 0, { duplicateReviewed: true }), wallet('a2', 4290, 'Mercado Dia', 1)]), []);
});
