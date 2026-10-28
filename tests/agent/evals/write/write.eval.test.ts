import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderWriteReport, runWriteSuite } from './run.write.suite.ts';
import { WRITE_EVAL_SCENARIOS } from './write.scenarios.ts';

describe('avaliacao de escrita segura (SC-003)', () => {
  it('conjunto offline: >= 95% dos planos aprovados sem edicao, 0 valores trocados e 0 gravacoes sem aprovacao', async () => {
    const { report, scores } = await runWriteSuite();
    assert.equal(report.total, 12);
    assert.equal(WRITE_EVAL_SCENARIOS.length, 12);
    assert.ok(report.acceptedRate >= 0.95, JSON.stringify(report.failures));
    assert.equal(report.wrongValues, 0);
    assert.equal(report.unapprovedWrites, 0);
    assert.ok(scores.every((s) => !s.unapprovedWrite));
    assert.equal(report.ok, true, report.violations.join('; '));
    assert.match(renderWriteReport(report), /Resultado: \*\*aprovado\*\*/);
  });

  it('deteccao de regressao: um modelo que troca o valor reprova a suite e o relatorio aponta os cenarios', async () => {
    const { report } = await runWriteSuite({
      transform: (args) => ({ ...args, operations: (args['operations'] as Record<string, unknown>[]).map((op) => ('amountCents' in op ? { ...op, amountCents: Number(op['amountCents']) + 1 } : op)) }),
    });
    assert.equal(report.ok, false);
    assert.ok(report.wrongValues > 0);
    assert.ok(report.acceptedRate < 0.95);
    const text = renderWriteReport(report);
    assert.match(text, /Resultado: \*\*reprovado\*\*/);
    assert.match(text, /lancar\.despesa/);
    assert.match(text, /amountCents/);
  });

  it('um modelo que ignora a conta e inventa outra e pego pelo gabarito', async () => {
    const { report } = await runWriteSuite({
      scenarios: WRITE_EVAL_SCENARIOS.filter((s) => s.id === 'lancar.despesa'),
      transform: (args) => ({ ...args, operations: (args['operations'] as Record<string, unknown>[]).map((op) => ({ ...op, accountId: 'acc-carteira' })) }),
    });
    assert.equal(report.ok, false);
    assert.match(report.failures[0]?.reasons.join(' ') ?? '', /accountId/);
  });
});
