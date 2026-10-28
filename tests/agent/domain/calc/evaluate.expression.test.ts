import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluateExpression } from '../../../../src/domain/agent/calc/evaluate.expression.ts';
import { CalcDivisionByZeroError } from '../../../../src/domain/agent/errors/calc.division.by.zero.error.ts';
import { CalcInvalidExpressionError } from '../../../../src/domain/agent/errors/calc.invalid.expression.error.ts';

describe('evaluateExpression (spec 037, T017)', () => {
  it('soma, subtracao, multiplicacao, divisao com precedencia e parenteses em centavos', () => {
    assert.equal(evaluateExpression('10 + 20 * 3').value, 7_000);
    assert.equal(evaluateExpression('(10 + 20) * 3').value, 9_000);
    assert.equal(evaluateExpression('1234,56 + 65,44').value, 130_000);
    assert.equal(evaluateExpression('1.234,56 - 234,56').value, 100_000);
    assert.equal(evaluateExpression('1234.56 + 0.44').value, 123_500);
    assert.equal(evaluateExpression('-50 + 200').value, 15_000);
  });

  it('percentual (%) e simulacao "e se cortar 20%"', () => {
    assert.equal(evaluateExpression('1500 * 20%').value, 30_000);
    assert.equal(evaluateExpression('1500 * (1 - 20%)').value, 120_000);
    assert.equal(evaluateExpression('800 * 12,5%').value, 10_000);
  });

  it('arredondamento half-even (bankers rounding) no meio centavo', () => {
    assert.equal(evaluateExpression('0,005').value, 0);
    assert.equal(evaluateExpression('0,015').value, 2);
    assert.equal(evaluateExpression('0,025').value, 2);
    assert.equal(evaluateExpression('0,035').value, 4);
    assert.equal(evaluateExpression('10 / 3').value, 333);
  });

  it('divisao por zero lanca CalcDivisionByZeroError', () => {
    assert.throws(() => evaluateExpression('100 / 0'), CalcDivisionByZeroError);
    assert.throws(() => evaluateExpression('100 / (5 - 5)'), CalcDivisionByZeroError);
  });

  it('identificadores, funcoes ou sintaxe invalida lancam CalcInvalidExpressionError', () => {
    assert.throws(() => evaluateExpression(''), CalcInvalidExpressionError);
    assert.throws(() => evaluateExpression('abc + 1'), CalcInvalidExpressionError);
    assert.throws(() => evaluateExpression('Math.max(1, 2)'), CalcInvalidExpressionError);
    assert.throws(() => evaluateExpression('10 + * 2'), CalcInvalidExpressionError);
    assert.throws(() => evaluateExpression('(10 + 2'), CalcInvalidExpressionError);
    assert.throws(() => evaluateExpression('10 + 2)'), CalcInvalidExpressionError);
  });
});

