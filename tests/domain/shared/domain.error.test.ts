import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DomainError } from '../../../src/domain/shared/domain.error.ts';
import { isDomainError } from '../../../src/domain/shared/is.domain.error.ts';

/** Subclasse concreta apenas para exercitar a base abstrata. */
class SampleError extends DomainError {
  public constructor() {
    super('SAMPLE', 'algo previsivel falhou');
  }
}

test('DomainError expoe code, message e continua sendo um Error', () => {
  const error = new SampleError();

  assert.ok(error instanceof Error);
  assert.ok(error instanceof DomainError);
  assert.equal(error.code, 'SAMPLE');
  assert.equal(error.message, 'algo previsivel falhou');
  assert.equal(error.name, 'SampleError');
});

test('isDomainError distingue erro de dominio de erro comum', () => {
  assert.equal(isDomainError(new SampleError()), true);
  assert.equal(isDomainError(new Error('boom')), false);
  assert.equal(isDomainError('boom'), false);
  assert.equal(isDomainError(null), false);
});
