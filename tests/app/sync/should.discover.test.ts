import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shouldDiscover } from '../../../src/app/sync/should.discover.ts';

const now = new Date('2026-09-30T12:00:00.000Z');
const ago = (ms: number) => new Date(now.getTime() - ms);

test('acao do usuario sempre busca (spec 024, U1)', () => {
  assert.equal(shouldDiscover({ unreachable: true, lastDiscoveryAt: ago(1000), now, manual: true }), true);
});

test('automatico: primeira busca ou desktop nao marcado como sumido -> busca', () => {
  assert.equal(shouldDiscover({ unreachable: false, lastDiscoveryAt: ago(1000), now, manual: false }), true);
  assert.equal(shouldDiscover({ unreachable: true, lastDiscoveryAt: null, now, manual: false }), true);
});

test('automatico com desktop sumido: espera 2 min entre buscas', () => {
  assert.equal(shouldDiscover({ unreachable: true, lastDiscoveryAt: ago(119_999), now, manual: false }), false);
  assert.equal(shouldDiscover({ unreachable: true, lastDiscoveryAt: ago(120_000), now, manual: false }), true);
});
