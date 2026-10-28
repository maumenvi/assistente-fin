import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { fixtureLlmFactory, FIXTURES_ROOT, runSuite } from './run.suite.ts';
import { renderEvalReport } from './score.report.ts';

const sets = readdirSync(FIXTURES_ROOT).filter((name) => statSync(join(FIXTURES_ROOT, name)).isDirectory());

describe('suite de avaliacao offline (SC-006)', () => {
  it('existe ao menos o conjunto de fixtures de pipeline', () => {
    assert.ok(sets.includes('pipeline'));
  });

  for (const model of sets) {
    it(`conjunto "${model}": exatidao >= 95%, 0 valores inventados e 0 escritas indevidas`, async () => {
      const { report } = await runSuite({ model, llmFor: fixtureLlmFactory(model) });
      assert.ok(report.ok, renderEvalReport(report));
      assert.ok(report.total >= 60, `so ${report.total} cenarios`);
    });
  }
});
