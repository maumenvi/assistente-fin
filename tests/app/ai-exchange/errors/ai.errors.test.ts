import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AiBlockNotFoundError } from '../../../../src/app/ai-exchange/errors/ai.block.not.found.error.ts';
import { AiBlockInvalidError } from '../../../../src/app/ai-exchange/errors/ai.block.invalid.error.ts';
import { AiBlockVersionError } from '../../../../src/app/ai-exchange/errors/ai.block.version.error.ts';
import { AiBatchAlreadyAppliedError } from '../../../../src/app/ai-exchange/errors/ai.batch.already.applied.error.ts';
import { AiBatchNotFoundError } from '../../../../src/app/ai-exchange/errors/ai.batch.not.found.error.ts';
import { AiBatchStateError } from '../../../../src/app/ai-exchange/errors/ai.batch.state.error.ts';

test('cada erro da feature tem codigo proprio e carrega o contexto', () => {
  assert.equal(new AiBlockNotFoundError().code, 'AI_BLOCK_NOT_FOUND');
  assert.equal(new AiBlockVersionError('v2').found, 'v2');
  assert.equal(new AiBlockInvalidError([{ opIndex: 1, path: 'id', message: 'm' }]).issues[0]?.opIndex, 1);
  assert.equal(new AiBatchAlreadyAppliedError('b1').batchId, 'b1');
  assert.equal(new AiBatchNotFoundError().code, 'AI_BATCH_NOT_FOUND');
  assert.equal(new AiBatchStateError('x').code, 'AI_BATCH_STATE');
});
