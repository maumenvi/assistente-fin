import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runRefresh } from '../../../src/app/ai-exchange/refresh.action.ts';

function setup(candidate: string | null, outcome: 'offered' | 'invalid' | 'none') {
  const log: string[] = [];
  const offered: (string | null)[] = [];
  const deps = {
    syncNow: () => log.push('sync'),
    bump: () => log.push('bump'),
    readClipboardCandidate: () => candidate,
    offer: async (text: string | null) => {
      offered.push(text);
      return outcome;
    },
  };
  return { deps, log, offered };
}

test('atualizar sincroniza, recarrega as telas e oferece o bloco da area de transferencia (spec 029, FR-019)', async () => {
  const { deps, log, offered } = setup('FINCTRL-IMPORT v1 {}', 'offered');
  const result = await runRefresh(deps);
  assert.deepEqual(log, ['sync', 'bump']);
  assert.deepEqual(offered, ['FINCTRL-IMPORT v1 {}']);
  assert.deepEqual(result, { outcome: 'offered', message: null });
});

test('sem nada novo: "Tudo em dia", sem erro', async () => {
  const { deps } = setup(null, 'none');
  assert.deepEqual(await runRefresh(deps), { outcome: 'none', message: 'Tudo em dia.' });
});

test('bloco invalido leva a tela de erro, sem mensagem de "em dia"', async () => {
  const { deps } = setup('FINCTRL-IMPORT v9', 'invalid');
  assert.deepEqual(await runRefresh(deps), { outcome: 'invalid', message: null });
});
