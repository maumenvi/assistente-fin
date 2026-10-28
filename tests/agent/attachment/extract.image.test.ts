import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractImage, PREVIEW_SIDE_PX } from '../../../src/app/agent/attachment/extract/extract.image.ts';
import { toBase64 } from '../../../src/app/agent/attachment/model/to.base64.ts';
import { ATTACHMENT_LIMITS } from '../../../src/domain/agent/attachment/attachment.limits.ts';
import { AttachmentUnreadableError } from '../../../src/domain/agent/attachment/errors/attachment.unreadable.error.ts';
import { FakeImageReducer } from '../../support/attachments/fake.image.reducer.ts';
import { sampleJpg, samplePng } from '../../support/attachments/build.attachment.fixtures.ts';
import { imageReducerContract } from './image.reducer.contract.ts';

describe('contrato do redutor de imagem (falso)', () => {
  imageReducerContract(() => new FakeImageReducer());
});

describe('extractImage', () => {
  it('reduz a 2 000 px de lado maior e gera a miniatura de 160 px como data URL', async () => {
    const reducer = new FakeImageReducer(4000);
    const out = await extractImage(samplePng(), 'image/png', reducer);
    assert.deepEqual(reducer.calls.map((c) => c.maxSidePx), [ATTACHMENT_LIMITS.maxImageSidePx, PREVIEW_SIDE_PX]);
    assert.equal(out.mediaType, 'image/jpeg');
    assert.equal(out.previewDataUrl, `data:image/jpeg;base64,${toBase64(sampleJpg())}`);
  });

  it('imagem corrompida: AttachmentUnreadableError(corrupt) e nada e guardado', async () => {
    await assert.rejects(extractImage(new TextEncoder().encode('xx'), 'image/png', new FakeImageReducer()), (e: unknown) => e instanceof AttachmentUnreadableError && e.reason === 'corrupt');
  });

  it('toBase64 confere com o Buffer', () => {
    for (const size of [0, 1, 2, 3, 4, 5, 100]) {
      const bytes = Uint8Array.from({ length: size }, (_, i) => (i * 37) % 256);
      assert.equal(toBase64(bytes), Buffer.from(bytes).toString('base64'));
    }
  });
});
