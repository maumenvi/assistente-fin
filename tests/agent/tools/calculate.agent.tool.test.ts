import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateTool } from '../../../src/app/agent/tools/calculate.agent.tool.ts';
import { DEFAULT_TOOL_LIMITS } from '../../../src/app/agent/tools/default.tool.limits.ts';
import { FactLedger } from '../../../src/app/agent/verify/fact.ledger.ts';
import { verifyFigures } from '../../../src/app/agent/verify/verify.figures.ts';

const CTX = {
  userId: 'u1',
  now: new Date('2026-10-15T12:00:00Z'),
  locale: 'pt-BR' as const,
  limits: DEFAULT_TOOL_LIMITS,
};

describe('calculate tool (spec 037, T020)', () => {
  it('avalia expressao ("e se cortar 20%"), gera fato e verifyFigures aceita o numero', async () => {
    const tool = calculateTool();
    const res = await tool.run({ op: 'expr', expression: '1500 * (1 - 20%)' }, CTX);
    assert.equal(res.ok, true);
    assert.match(res.contentForModel, /R\$ 1\.200,00/);
    const ledger = new FactLedger(res.facts);
    assert.equal(verifyFigures('Se cortar 20%, sobram R$ 1.200,00 por mês.', ledger).ok, true);
  });

  it('resolve operacoes nomeadas com valores diretos e referencias {fact}, inclusive percentual negativo', async () => {
    const tool = calculateTool();
    const withTurn = {
      ...CTX,
      turn: {
        runId: 'r1',
        assistantMessageId: 'm1',
        userText: 'quanto caiu?',
        knownMoneyCents: [200_000, 150_000],
        ledger: [
          { id: 'ago', kind: 'money' as const, value: 200_000, display: 'R$ 2.000,00', label: 'agosto', sourceCallId: 'c1' },
          { id: 'set', kind: 'money' as const, value: 150_000, display: 'R$ 1.500,00', label: 'setembro', sourceCallId: 'c2' },
        ],
      },
    };
    const diff = await tool.run({ op: 'diff', values: [{ fact: 'set' }, { fact: 'ago' }] }, withTurn);
    assert.equal(diff.ok, true);
    const pct = await tool.run({ op: 'pct_change', values: [{ fact: 'ago' }, { fact: 'set' }] }, withTurn);
    assert.equal(pct.ok, true);
    assert.match(pct.contentForModel, /-25%/);
    const ledger = new FactLedger([...diff.facts, ...pct.facts]);
    assert.equal(verifyFigures('Caiu R$ 500,00 (-25%).', ledger).ok, true);
  });

  it('divisao por zero ou fato inexistente devolve erro explicativo (nunca 0)', async () => {
    const tool = calculateTool();
    const divZero = await tool.run({ op: 'expr', expression: '100 / 0' }, CTX);
    assert.equal(divZero.ok, false);
    assert.match(divZero.error?.message ?? '', /zero/);
    const missingFact = await tool.run({ op: 'sum', values: [{ fact: 'inexistente' }] }, CTX);
    assert.equal(missingFact.ok, false);
    assert.match(missingFact.error?.message ?? '', /inexistente/);
  });
});

