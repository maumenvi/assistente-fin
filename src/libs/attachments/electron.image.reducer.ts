import { type ImageReducerPort, type ReducedImage } from '../../app/agent/attachment/ports/image.reducer.port.ts';
import { AttachmentUnreadableError } from '../../domain/agent/attachment/errors/attachment.unreadable.error.ts';

/** Qualidade do JPEG gerado (0-100). */
const JPEG_QUALITY = 85;

/**
 * Redutor de imagem do desktop (spec 036, R5) com o `nativeImage` do Electron: so no processo principal. Decodifica PNG/JPEG,
 * reduz mantendo a proporcao ate o lado maior pedido e regrava como JPEG, o que descarta EXIF/localizacao.
 */
export class ElectronImageReducer implements ImageReducerPort {
  public async reduce(bytes: Uint8Array, _mediaType: string, maxSidePx: number): Promise<ReducedImage> {
    // carregado so aqui: fora do Electron (testes em Node) o modulo `electron` nao exporta o `nativeImage`
    const { nativeImage } = await import('electron');
    let image = nativeImage.createFromBuffer(Buffer.from(bytes));
    if (image.isEmpty()) throw new AttachmentUnreadableError('corrupt');
    const { width, height } = image.getSize();
    const longest = Math.max(width, height);
    if (longest > maxSidePx) {
      const scale = maxSidePx / longest;
      image = image.resize({ width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), quality: 'best' });
    }
    const out = image.toJPEG(JPEG_QUALITY);
    if (out.length === 0) throw new AttachmentUnreadableError('corrupt');
    const size = image.getSize();
    return { bytes: new Uint8Array(out), mediaType: 'image/jpeg', width: size.width, height: size.height };
  }
}
