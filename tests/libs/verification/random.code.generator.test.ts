import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RandomCodeGenerator } from '../../../src/libs/verification/random.code.generator.ts';

const CODE_PATTERN = /^\d{6}$/;

test('next gera codigos de 6 digitos numericos, com variacao', () => {
  const generator = new RandomCodeGenerator();
  const codes = new Set<string>();

  for (let i = 0; i < 200; i += 1) {
    const code = generator.next();
    assert.match(code, CODE_PATTERN);
    codes.add(code);
  }

  assert.ok(codes.size > 1, 'gerando 200 codigos, deveria haver alguma variacao');
});
