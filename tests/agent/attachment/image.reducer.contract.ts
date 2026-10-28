import assert from 'node:assert/strict';
import { it } from 'node:test';
import { type ImageReducerPort } from '../../../src/app/agent/attachment/ports/image.reducer.port.ts';
import { AttachmentUnreadableError } from '../../../src/domain/agent/attachment/errors/attachment.unreadable.error.ts';
import { samplePng } from '../../support/attachments/build.attachment.fixtures.ts';

/** Contrato de qualquer `ImageReducerPort` (falso, `nativeImage`, `expo-image-manipulator`): JPEG, no limite pedido, imagem ilegivel => corrompida. */
export function imageReducerContract(make: () => ImageReducerPort): void {
  it('devolve JPEG com o lado maior dentro do limite pedido', async () => {
    const out = await make().reduce(samplePng(), 'image/png', 2000);
    assert.equal(out.mediaType, 'image/jpeg');
    assert.ok(Math.max(out.width, out.height) <= 2000);
    assert.ok(out.bytes.byteLength > 0);
    assert.deepEqual([...out.bytes.slice(0, 2)], [0xff, 0xd8], 'assinatura JPEG');
  });

  it('bytes que nao sao imagem => AttachmentUnreadableError(corrupt)', async () => {
    await assert.rejects(make().reduce(new TextEncoder().encode('isto nao e imagem'), 'image/png', 2000), (e: unknown) => e instanceof AttachmentUnreadableError && e.reason === 'corrupt');
  });
}
