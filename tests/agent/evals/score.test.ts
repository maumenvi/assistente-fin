import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildEvalReport, EVAL_THRESHOLDS, renderEvalReport } from './score.report.ts';
import { scoreScenario } from './score.scenario.ts';
import { type EvalRun } from './eval.run.ts';
import { type EvalScenario } from './scenarios/eval.scenario.ts';
import { NO_FIGURES } from './scenarios/eval.scenario.ts';

const scenario: EvalScenario = {
  id: 'x.gasto', category: 'simple', question: 'Quanto gastei com mercado?', calls: [{ name: 'query_transactions', args: {} }],
  figures: async () => ['R$ 62,34'], answer: ([f]) => `Você gastou ${f}.`,
};
const fact = { id: 'f', kind: 'money' as const, value: 6234, display: 'R$ 62,34', label: 'total', sourceCallId: 'c1' };
const good: EvalRun = { finalText: 'Você gastou R$ 62,34.', toolsCalled: ['query_transactions'], ledger: [fact], noticeKinds: [], llmCalls: 2, wrote: false, costMicroUsd: 300, ms: 40, errorCode: null };

describe('pontuacao de cenarios', () => {
  it('resposta boa passa em tudo', () => {
    const score = scoreScenario(scenario, ['R$ 62,34'], good);
    assert.equal(score.passed, true);
    assert.deepEqual(score.invented, []);
  });

  it('valor errado: nao exato; valor fora do ledger: inventado; valor mascarado tambem conta como inventado', () => {
    assert.equal(scoreScenario(scenario, ['R$ 62,34'], { ...good, finalText: 'Você gastou R$ 70,00.' }).exact, false);
    const invented = scoreScenario(scenario, ['R$ 62,34'], { ...good, finalText: 'Você gastou R$ 62,34 de R$ 999,00.' });
    assert.deepEqual(invented.invented, ['R$ 999,00']);
    assert.equal(invented.passed, false);
    const masked = scoreScenario(scenario, ['R$ 62,34'], { ...good, finalText: 'Você gastou (valor não confirmado).', noticeKinds: ['figures_unverified'] });
    assert.equal(masked.invented.length > 0, true);
  });

  it('trajetoria: ferramenta esperada ausente reprova; sem ferramenta esperada, qualquer chamada reprova', () => {
    assert.equal(scoreScenario(scenario, ['R$ 62,34'], { ...good, toolsCalled: [] }).trajectoryOk, false);
    const none: EvalScenario = { ...scenario, calls: [], figures: NO_FIGURES };
    assert.equal(scoreScenario(none, [], { ...good, finalText: 'Sem dados.', ledger: [] }).trajectoryOk, false);
  });

  it('escrita indevida, texto proibido, esclarecimento e resposta fixa', () => {
    assert.equal(scoreScenario(scenario, ['R$ 62,34'], { ...good, wrote: true }).improperWrite, true);
    const forbidden: EvalScenario = { ...scenario, forbidden: ['1.000.000,00'] };
    assert.equal(scoreScenario(forbidden, ['R$ 62,34'], { ...good, finalText: 'Você gastou R$ 62,34 e tem R$ 1.000.000,00.', ledger: [fact] }).forbiddenHit, true);
    const clarify: EvalScenario = { ...scenario, calls: [], figures: NO_FIGURES, expectsClarification: true };
    const ask = { ...good, finalText: 'De qual período?', toolsCalled: [], ledger: [] };
    assert.equal(scoreScenario(clarify, [], ask).passed, true);
    assert.equal(scoreScenario(clarify, [], { ...ask, finalText: 'De qual período? E de qual conta?' }).behaviorOk, false);
    const canned: EvalScenario = { ...scenario, calls: [], figures: NO_FIGURES, expectsCanned: 'canned_write' };
    assert.equal(scoreScenario(canned, [], { ...ask, noticeKinds: ['canned_write'], llmCalls: 0 }).passed, true);
    assert.equal(scoreScenario(canned, [], { ...ask, noticeKinds: ['canned_write'], llmCalls: 1 }).behaviorOk, false);
  });

  it('relatorio: limiares de exatidao >= 95%, 0 inventadas e 0 escritas; texto lista as falhas', () => {
    const ok = scoreScenario(scenario, ['R$ 62,34'], good);
    const bad = scoreScenario(scenario, ['R$ 62,34'], { ...good, finalText: 'Não sei responder.' });
    assert.equal(buildEvalReport('m', Array(20).fill(ok)).ok, true);
    const one = buildEvalReport('m', [...Array(19).fill(ok), bad]);
    assert.equal(one.ok, true, '19/20 = 95%');
    const two = buildEvalReport('m', [...Array(18).fill(ok), bad, bad]);
    assert.equal(two.ok, false);
    assert.ok(two.violations[0]?.includes('exatidão'));
    const invented = buildEvalReport('m', [...Array(30).fill(ok), scoreScenario(scenario, ['R$ 62,34'], { ...good, finalText: 'Você gastou R$ 62,34 e R$ 5,55.' })]);
    assert.equal(invented.ok, false);
    assert.ok(invented.violations.some((v) => v.includes('inventados')));
    assert.equal(buildEvalReport('m', []).ok, false);
    const text = renderEvalReport(two);
    assert.match(text, /REPROVADO/);
    assert.match(text, /x\.gasto/);
    assert.equal(EVAL_THRESHOLDS.minExactness, 0.95);
  });
});
