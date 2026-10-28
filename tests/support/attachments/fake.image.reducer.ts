import { type ImageReducerPort, type ReducedImage } from '../../../src/app/agent/attachment/ports/image.reducer.port.ts';
import { AttachmentUnreadableError } from '../../../src/domain/agent/attachment/errors/attachment.unreadable.error.ts';
import { sampleJpg } from './build.attachment.fixtures.ts';

/** Redutor de imagem de mentira: aceita PNG/JPEG de verdade (assinatura), devolve um JPEG pequeno e registra os pedidos. */
export class FakeImageReducer implements ImageReducerPort {
  public readonly calls: { readonly mediaType: string; readonly maxSidePx: number; readonly size: number }[] = [];
  /** Dimensao "original" simulada (lado maior). */
  private readonly originalSide: number;

  public constructor(originalSide = 4000) {
    this.originalSide = originalSide;
  }

  public reduce(bytes: Uint8Array, mediaType: string, maxSidePx: number): Promise<ReducedImage> {
    this.calls.push({ mediaType, maxSidePx, size: bytes.byteLength });
    const png = bytes[0] === 0x89 && bytes[1] === 0x50;
    const jpg = bytes[0] === 0xff && bytes[1] === 0xd8;
    if (!png && !jpg) return Promise.reject(new AttachmentUnreadableError('corrupt'));
    const side = Math.min(this.originalSide, maxSidePx);
    return Promise.resolve({ bytes: sampleJpg(), mediaType: 'image/jpeg', width: side, height: Math.round(side * 0.75) });
  }
}
