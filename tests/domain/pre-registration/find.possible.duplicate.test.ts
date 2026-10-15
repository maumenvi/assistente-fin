import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findPossibleDuplicate } from '../../../src/domain/pre-registration/find.possible.duplicate.ts';

const day = (iso: string) => new Date(`${iso}T15:00:00.000Z`);

test('mesma chave de captura em outro pre-registro', () => {
  const found = findPossibleDuplicate(
    { dedupKey: 'nota-1', amountCents: null, date: null, description: null },
    [{ id: 'p1', dedupKey: 'nota-1', amountCents: null, date: null, description: null, notes: null }],
    [],
  );
  assert.equal(found, 'p1');
});

test('link da nota ja presente na observacao de um lancamento', () => {
  const found = findPossibleDuplicate(
    { dedupKey: 'CHAVE44', link: 'https://sefaz.sp.gov.br/nfce?p=CHAVE44|2|1', amountCents: 21248, date: day('2026-09-24'), description: 'Mercado' },
    [],
    [{ id: 't1', amountCents: 999, date: day('2026-09-01'), notes: 'comprei https://sefaz.sp.gov.br/nfce?p=CHAVE44|2|1' }],
  );
  assert.equal(found, 't1');
});

test('mesmo valor, mesmo dia e mesma descricao (sem acento/caixa)', () => {
  const found = findPossibleDuplicate(
    { dedupKey: null, amountCents: 6500, date: day('2026-09-24'), description: 'Queijo' },
    [],
    [{ id: 't9', amountCents: 6500, date: new Date('2026-09-24T22:00:00.000Z'), notes: 'QUEIJO' }],
  );
  assert.equal(found, 't9');
});

test('valor igual em outro dia, ou descricao diferente, nao e duplicata', () => {
  const tx = [{ id: 't9', amountCents: 6500, date: day('2026-09-23'), notes: 'queijo' }];
  assert.equal(findPossibleDuplicate({ dedupKey: null, amountCents: 6500, date: day('2026-09-24'), description: 'queijo' }, [], tx), null);
  assert.equal(findPossibleDuplicate({ dedupKey: null, amountCents: 6500, date: day('2026-09-23'), description: 'pao' }, [], tx), null);
});
