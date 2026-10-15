import { test } from 'node:test';
import assert from 'node:assert/strict';
import { constantTimeEquals } from '../../../src/app/shared/constant.time.equals.ts';

test('constantTimeEquals: iguais, diferentes e comprimentos distintos', () => {
  assert.equal(constantTimeEquals('123456', '123456'), true);
  assert.equal(constantTimeEquals('123456', '123457'), false);
  assert.equal(constantTimeEquals('023456', '123456'), false);
  assert.equal(constantTimeEquals('12345', '123456'), false);
  assert.equal(constantTimeEquals('', ''), true);
});
