/** Resultado de reduzir uma imagem: JPEG no tamanho aceito, sem metadados (EXIF/localizacao). */
export interface ReducedImage {
  readonly bytes: Uint8Array;
  readonly mediaType: 'image/jpeg';
  readonly width: number;
  readonly height: number;
}

/**
 * Reduz uma imagem (spec 036, R5): lado maior ate o limite, reconvertida para JPEG (descarta EXIF). Cada borda tem o seu
 * adaptador (`nativeImage` no desktop, `expo-image-manipulator` no Android). Lanca `AttachmentUnreadableError('corrupt')`.
 */
export interface ImageReducerPort {
  reduce(bytes: Uint8Array, mediaType: string, maxSidePx: number): Promise<ReducedImage>;
}
