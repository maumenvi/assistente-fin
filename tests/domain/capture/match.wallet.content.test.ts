import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchWalletContent } from '../../../src/domain/capture/match.wallet.content.ts';
import { type WalletContentCandidate } from '../../../src/domain/capture/wallet.content.candidate.ts';

const T0 = new Date('2026-10-13T16:00:00.000Z');
const after = (seconds: number) => new Date(T0.getTime() + seconds * 1000);
const candidate = (extra: Partial<WalletContentCandidate> = {}): WalletContentCandidate => ({
  id: 'p1',
  createdAt: T0,
  amountCents: 1850,
  description: 'Café do Zé',
  accountId: 'nubank',
  ...extra,
});

test('casa dentro da janela com valor, estabelecimento e conta iguais', () => {
  assert.equal(matchWalletContent({ amountCents: 1850, description: 'Café do Zé' }, { id: 'nubank', hinted: true }, [candidate()], after(74))?.id, 'p1');
});

test('nao casa fora da janela (180001 ms) nem com valor diferente', () => {
  assert.equal(matchWalletContent({ amountCents: 1850, description: 'Café do Zé' }, { id: 'nubank', hinted: true }, [candidate()], new Date(T0.getTime() + 180_001)), null);
  assert.equal(matchWalletContent({ amountCents: 1850, description: 'Café do Zé' }, { id: 'nubank', hinted: true }, [candidate()], new Date(T0.getTime() + 180_000))?.id, 'p1');
  assert.equal(matchWalletContent({ amountCents: 1900, description: 'Café do Zé' }, { id: 'nubank', hinted: true }, [candidate()], after(5)), null);
});

test('nao casa com estabelecimento ou conta em conflito', () => {
  assert.equal(matchWalletContent({ amountCents: 1850, description: 'Padaria' }, { id: 'nubank', hinted: true }, [candidate()], after(5)), null);
  assert.equal(matchWalletContent({ amountCents: 1850, description: 'Café do Zé' }, { id: 'itau', hinted: true }, [candidate()], after(5)), null);
});

test('cartao citado que nao casa com nenhuma conta conflita com um candidato que tem conta', () => {
  assert.equal(matchWalletContent({ amountCents: 1850, description: 'Café do Zé' }, { id: null, hinted: true }, [candidate()], after(5)), null);
  assert.equal(matchWalletContent({ amountCents: 1850, description: 'Café do Zé' }, { id: null, hinted: true }, [candidate({ accountId: null })], after(5))?.id, 'p1');
});

test('sem valor na notificacao nunca casa', () => {
  assert.equal(matchWalletContent({ description: 'Café do Zé' }, { id: 'nubank', hinted: true }, [candidate()], after(5)), null);
});

test('so o valor igual, sem nada comparavel, so casa na janela curta (60 s)', () => {
  const bare = candidate({ description: null, accountId: null });
  assert.equal(matchWalletContent({ amountCents: 1850 }, { id: null, hinted: false }, [bare], after(40))?.id, 'p1');
  assert.equal(matchWalletContent({ amountCents: 1850 }, { id: null, hinted: false }, [bare], after(90)), null);
});

test('Pix sem estabelecimento seguido de Pix com estabelecimento: 40 s casa, 90 s nao', () => {
  const pix = candidate({ description: null, accountId: null });
  assert.equal(matchWalletContent({ amountCents: 1850, description: 'Café do Zé' }, { id: null, hinted: false }, [pix], after(40))?.id, 'p1');
  assert.equal(matchWalletContent({ amountCents: 1850, description: 'Café do Zé' }, { id: null, hinted: false }, [pix], after(90)), null);
});

test('estabelecimento ausente num lado mas conta igual: vale a janela inteira', () => {
  const semNome = candidate({ description: null });
  assert.equal(matchWalletContent({ amountCents: 1850, description: 'Café do Zé' }, { id: 'nubank', hinted: true }, [semNome], after(120))?.id, 'p1');
});

test('ignora acento, caixa e espacos extras no estabelecimento', () => {
  assert.equal(matchWalletContent({ amountCents: 1850, description: '  CAFE   do ze ' }, { id: null, hinted: false }, [candidate({ accountId: null })], after(120))?.id, 'p1');
});

test('com varios candidatos devolve o mais antigo', () => {
  const novo = candidate({ id: 'p2', createdAt: after(10) });
  assert.equal(matchWalletContent({ amountCents: 1850, description: 'Café do Zé' }, { id: 'nubank', hinted: true }, [novo, candidate()], after(30))?.id, 'p1');
});

test('candidato criado no futuro em relacao a `now` e ignorado', () => {
  assert.equal(matchWalletContent({ amountCents: 1850, description: 'Café do Zé' }, { id: 'nubank', hinted: true }, [candidate({ createdAt: after(10) })], T0), null);
});
