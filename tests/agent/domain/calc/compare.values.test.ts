import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { compareValues, pctChangeBp } from '../../../../src/domain/agent/calc/compare.values.ts';
import { CalcDivisionByZeroError } from '../../../../src/domain/agent/errors/calc.division.by.zero.error.ts';
import { CalcNoDataError } from '../../../../src/domain/agent/errors/calc.no.data.error.ts';

describe('compareValues e pctChangeBp (spec 037, T019)', () => {
  it('sum, avg e diff exatos em centavos com half-even', () => {
    assert.equal(compareValues({ op: 'sum', valuesCents: [10_000, 25_050, 4_950] }).value, 40_000);
    assert.equal(compareValues({ op: 'avg', valuesCents: [10_000, 20_000, 30_000] }).value, 20_000);
    assert.equal(compareValues({ op: 'avg', valuesCents: [1, 2] }).value, 2);
    assert.equal(compareValues({ op: 'diff', valuesCents: [150_000, 120_000] }).value, 30_000);
  });

  it('pct_of e pct_change em pontos-base (1% = 100 bp) e null quando base 0', () => {
    const share = compareValues({ op: 'pct_of', valuesCents: [130_000, 650_000] });
    assert.equal(share.kind, 'percent');
    assert.equal(share.value, 2_000); // 20,00%
    const change = compareValues({ op: 'pct_change', valuesCents: [100_000, 125_500] });
    assert.equal(change.kind, 'percent');
    assert.equal(change.value, 2_550); // +25,50%
    assert.equal(pctChangeBp(0, 50_000), null);
    assert.throws(() => compareValues({ op: 'pct_change', valuesCents: [0, 50_000] }), CalcDivisionByZeroError);
    assert.throws(() => compareValues({ op: 'pct_of', valuesCents: [10_000, 0] }), CalcDivisionByZeroError);
  });

  it('project multiplica a media pelos meses e lista vazia lanca CalcNoDataError', () => {
    assert.equal(compareValues({ op: 'project', valuesCents: [100_000, 200_000], months: 3 }).value, 450_000);
    assert.throws(() => compareValues({ op: 'sum', valuesCents: [] }), CalcNoDataError);
  });
});

