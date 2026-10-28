import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { COMPACTION_SCENARIOS } from './compaction.scenarios.ts';
import { oracleSummarizer } from './oracle.summarizer.ts';
import { renderCompactionReport, runCompactionSuite } from './run.compaction.suite.ts';
import { runCompactionScenario } from './run.compaction.scenario.ts';
import { scoreCompaction } from './score.compaction.ts';

describe('avaliacao de fidelidade da compactacao (FR-021, SC-005)', () => {
  it('conjunto offline: >= 95% dos fatos respondiveis depois de compactar, 0 valores repetidos, historico integro, prefixo estavel', async () => {
    const { report, scores } = await runCompactionSuite();
    assert.equal(report.total, 12);
    assert.ok(report.fidelity >= 0.95, `fidelidade ${String(report.fidelity)}`);
    assert.equal(report.valueLeaks, 0);
    assert.ok(scores.every((s) => s.compacted), 'a conversa estourou a janela pelo menos 3 vezes em todo cenario');
    assert.ok(scores.every((s) => s.historyIntact && s.prefixStable));
    assert.equal(report.ok, true, report.violations.join('; '));
    assert.match(renderCompactionReport(report), /Resultado: \*\*aprovado\*\*/);
  });

  it('o valor dito no comeco nao sobrevive como numero: a pergunta por ele exigiria nova consulta', async () => {
    const scenario = COMPACTION_SCENARIOS[0]!;
    const run = await runCompactionScenario(scenario, oracleSummarizer(scenario));
    assert.ok(!run.context.includes(scenario.planted.figure));
    assert.ok(!run.summaryText.includes('R$'));
  });

  it('deteccao de regressao: um resumidor que esquece decisao e pendencia reprova a suite', async () => {
    const { report, scores } = await runCompactionSuite({ summarizerFor: (s) => oracleSummarizer(s, { forget: new Set(['decision', 'pending']) }) });
    assert.equal(report.ok, false);
    assert.ok(report.fidelity < 0.95);
    assert.ok(scores.every((s) => s.missing.length === 2));
    assert.match(renderCompactionReport(report), /Resultado: \*\*reprovado\*\*/);
    assert.match(renderCompactionReport(report), /fidelidade/);
  });

  it('pontuacao: resumo com dinheiro e reprovado mesmo se os fatos estiverem la', async () => {
    const scenario = COMPACTION_SCENARIOS[1]!;
    const run = await runCompactionScenario(scenario, oracleSummarizer(scenario));
    const score = scoreCompaction(scenario, { ...run, summaryText: `${run.summaryText} R$ 10,00` });
    assert.equal(score.moneyInSummary, true);
    assert.equal(score.passed, false);
  });
});
