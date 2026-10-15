import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refreshLimitsWidget, type LimitsWidgetFrame, type LimitsWidgetRefreshPorts } from '../../../src/app/spending-limit/refresh.limits.widget.ts';
import { freshSnapshot, type LimitsWidgetSnapshot } from '../../../src/app/spending-limit/limits.widget.snapshot.ts';
import { type LimitsWidgetData } from '../../../src/app/spending-limit/limits.widget.data.ts';

/** Atualizacao em dois tempos do widget de limites (spec 023, T011). */
const NOW = new Date('2026-09-25T12:00:00.000Z');
const data = (percent: number): LimitsWidgetData => ({
  month: { year: 2026, month: 9 },
  spendingLimits: [{ id: 'l1', name: 'COMBUSTIVEL', kind: 'spending-limit', usedPercent: percent, status: 'normal' }],
  cards: [],
});

function ports(cached: LimitsWidgetSnapshot | null, compute: () => Promise<LimitsWidgetData | null>) {
  const log: string[] = [];
  const frames: LimitsWidgetFrame[] = [];
  let stored = cached;
  const p: LimitsWidgetRefreshPorts = {
    readSnapshot: async () => {
      log.push('read');
      return stored;
    },
    writeSnapshot: async (s) => {
      log.push('write');
      stored = s;
    },
    compute: async () => {
      log.push('compute');
      return compute();
    },
    draw: async (f) => {
      log.push(`draw:${f.refreshing ? 'refreshing' : 'done'}`);
      frames.push(f);
    },
    now: () => NOW,
  };
  return { p, log, frames, stored: () => stored };
}

test('desenha do resumo ANTES de recalcular; depois grava e redesenha com os dados novos', async () => {
  const old = freshSnapshot(data(10), new Date('2026-09-25T11:00:00.000Z'));
  const { p, log, frames, stored } = ports(old, async () => data(32));
  await refreshLimitsWidget(p);
  assert.deepEqual(log, ['read', 'draw:refreshing', 'compute', 'write', 'draw:done']);
  assert.equal(frames[0]?.snapshot?.data.spendingLimits[0]?.usedPercent, 10);
  assert.equal(frames[1]?.snapshot?.data.spendingLimits[0]?.usedPercent, 32);
  assert.equal(stored()?.lastAttemptFailedAt, null);
});

test('sem resumo: primeiro desenho e "carregando" (snapshot nulo, recalculando)', async () => {
  const { p, frames } = ports(null, async () => data(32));
  await refreshLimitsWidget(p);
  assert.deepEqual(frames[0], { snapshot: null, refreshing: true, hasUser: true });
});

test('falha no recalculo: mantem os dados e marca a falha (nunca em branco)', async () => {
  const old = freshSnapshot(data(10), new Date('2026-09-25T11:55:00.000Z'));
  const { p, frames, stored } = ports(old, async () => {
    throw new Error('banco indisponivel');
  });
  await refreshLimitsWidget(p);
  const last = frames.at(-1);
  assert.equal(last?.snapshot?.data.spendingLimits[0]?.usedPercent, 10);
  assert.equal(last?.snapshot?.lastAttemptFailedAt, NOW.toISOString());
  assert.equal(stored()?.lastAttemptFailedAt, NOW.toISOString());
});

test('sem usuario no aparelho: desenha o estado de primeiro uso', async () => {
  const { p, frames } = ports(null, async () => null);
  await refreshLimitsWidget(p);
  assert.deepEqual(frames.at(-1), { snapshot: null, refreshing: false, hasUser: false });
});
