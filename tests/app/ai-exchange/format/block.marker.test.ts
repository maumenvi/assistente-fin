import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blockMarker, BLOCK_MARKER_WORD } from '../../../../src/app/ai-exchange/format/block.marker.ts';
import { AGENT_FORMAT_VERSION } from '../../../../src/app/ai-exchange/format/format.version.ts';

test('a marca une a palavra e a versao do formato (spec 029, R1)', () => {
  assert.equal(blockMarker(), `FINCTRL-IMPORT v${AGENT_FORMAT_VERSION}`);
  assert.equal(blockMarker(2), 'FINCTRL-IMPORT v2');
  assert.ok(blockMarker().startsWith(BLOCK_MARKER_WORD));
});
