import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { defaultEvalCliDeps, modelDirName, parseEvalArgs, runEvalCli, type EvalCliDeps } from './agent.evals.cli.ts';

function deps(over: Partial<EvalCliDeps> = {}): EvalCliDeps & { lines: string[] } {
  const lines: string[] = [];
  const reportDir = mkdtempSync(join(tmpdir(), 'evals-'));
  return { ...defaultEvalCliDeps(), env: {}, out: (l) => void lines.push(l), confirm: async () => true, reportDir, baselineDir: join(reportDir, 'baseline'), lines, ...over };
}

describe('CLI da avaliacao (T139)', () => {
  it('interpreta os argumentos e recusa combinacoes invalidas', () => {
    assert.deepEqual(parseEvalArgs([]), { model: 'pipeline', live: false, record: false, only: null, yes: false, baseline: false, compare: false, suite: 'pipeline' });
    assert.deepEqual(parseEvalArgs(['--model', 'x', '--only', 'simple']), { model: 'x', live: false, record: false, only: 'simple', yes: false, baseline: false, compare: false, suite: 'pipeline' });
    assert.deepEqual(parseEvalArgs(['--baseline']), { model: 'pipeline', live: false, record: false, only: null, yes: false, baseline: true, compare: false, suite: 'pipeline' });
    assert.deepEqual(parseEvalArgs(['--compare']), { model: 'pipeline', live: false, record: false, only: null, yes: false, baseline: false, compare: true, suite: 'pipeline' });
    assert.ok('error' in parseEvalArgs(['--record']));
    assert.ok('error' in parseEvalArgs(['--live']));
    assert.ok('error' in parseEvalArgs(['--only', 'nada']));
    assert.ok('error' in parseEvalArgs(['--model']));
    assert.ok('error' in parseEvalArgs(['--qualquer']));
    assert.deepEqual(parseEvalArgs(['--suite', 'compaction']), { model: 'pipeline', live: false, record: false, only: null, yes: false, baseline: false, compare: false, suite: 'compaction' });
    assert.ok('error' in parseEvalArgs(['--suite', 'compaction', '--baseline']));
    assert.ok('error' in parseEvalArgs(['--suite', 'compaction', '--compare']));
    assert.ok('error' in parseEvalArgs(['--suite', 'outra']));
    assert.ok('error' in parseEvalArgs(['--suite', 'compaction', '--live', '--model', 'x']));
    assert.equal(modelDirName('anthropic/claude-sonnet-4'), 'anthropic__claude-sonnet-4');
  });

  it('--compare compara com baseline/pipeline.json e gera pipeline.compare.json/.md (spec 037, T046)', async () => {
    const d = deps({ baselineDir: join(import.meta.dirname, 'baseline') });
    assert.equal(await runEvalCli(['--compare'], d), 0);
    assert.ok(existsSync(join(d.reportDir, 'pipeline.compare.json')));
    assert.ok(existsSync(join(d.reportDir, 'pipeline.compare.md')));
    assert.match(d.lines.join('\n'), /Segurança: \*\*INTACTA\*\*/);
  });

  it('--baseline grava a linha de base em baseline/pipeline.json (spec 037, T014)', async () => {
    const d = deps();
    assert.equal(await runEvalCli(['--baseline'], d), 0);
    assert.ok(existsSync(join(d.reportDir, 'baseline', 'pipeline.json')));
    assert.ok(d.lines.join('\n').includes('linha de base gravada'));
  });

  it('offline: aprova o conjunto de pipeline (saida 0) e escreve o relatorio .json e .md', async () => {
    const d = deps();
    assert.equal(await runEvalCli([], d), 0);
    assert.ok(existsSync(join(d.reportDir, 'pipeline.md')));
    const json = JSON.parse(readFileSync(join(d.reportDir, 'pipeline.json'), 'utf8')) as { ok: boolean; total: number };
    assert.equal(json.ok, true);
    assert.ok(json.total >= 60);
    assert.ok(d.lines.join('\n').includes('APROVADO'));
  });

  it('--only filtra a categoria; fixture ausente (modelo sem fixtures) viola o limiar e sai com codigo 1', async () => {
    const d = deps();
    assert.equal(await runEvalCli(['--only', 'write'], d), 0);
    assert.equal(JSON.parse(readFileSync(join(d.reportDir, 'pipeline.json'), 'utf8')).total, 4);
    const missing = deps();
    assert.equal(await runEvalCli(['--model', 'modelo-sem-fixtures', '--only', 'simple'], missing), 1);
    assert.ok(missing.lines.join('\n').includes('REPROVADO'));
  });

  it('--live sem chave sai com 2; com chave pede confirmacao e cancela sem gastar', async () => {
    const noKey = deps();
    assert.equal(await runEvalCli(['--live', '--model', 'a/b'], noKey), 2);
    const cancel = deps({ env: { OPENROUTER_API_KEY: 'sk-x' }, confirm: async () => false });
    assert.equal(await runEvalCli(['--live', '--model', 'a/b', '--only', 'write'], cancel), 2);
    assert.ok(cancel.lines.join('\n').includes('custo estimado'));
  });

  it('--suite capability: roda offline, escreve capability.json/.md e sai com 0; combinar com --live e erro', async () => {
    const d = deps();
    assert.equal(await runEvalCli(['--suite', 'capability'], d), 0);
    assert.ok(existsSync(join(d.reportDir, 'capability.md')));
    assert.equal((JSON.parse(readFileSync(join(d.reportDir, 'capability.json'), 'utf8')) as { ok: boolean }).ok, true);
    assert.ok('error' in parseEvalArgs(['--suite', 'capability', '--live', '--model', 'x']));
  });

  it('--suite compaction: roda offline, escreve compaction.json/.md e sai com 0', async () => {
    const d = deps();
    assert.equal(await runEvalCli(['--suite', 'compaction'], d), 0);
    assert.ok(existsSync(join(d.reportDir, 'compaction.json')));
    assert.match(readFileSync(join(d.reportDir, 'compaction.md'), 'utf8'), /Resultado: \*\*aprovado\*\*/);
    assert.match(d.lines.join('\n'), /compactação/);
  });
});
