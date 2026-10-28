import { z } from 'zod';
import { AttachmentNotFoundError } from '../../../../domain/agent/attachment/errors/attachment.not.found.error.ts';
import { InvalidInputError } from '../../../shared/invalid.input.error.ts';
import { type AttachmentStorePort } from '../ports/attachment.store.port.ts';

const inputSchema = z.object({ userId: z.string().trim().min(1), attachmentId: z.string().trim().min(1).max(100) });

/** Um anexo para abrir: os bytes guardados (imagem ja reduzida; arquivo original). */
export interface OpenedAttachment {
  readonly name: string;
  readonly mediaType: string;
  readonly bytes: Uint8Array;
}

/** Abre um anexo ja enviado (spec 036, FR-012). So o dono o recebe; inexistente/apagado/de outro usuario => `AttachmentNotFoundError`. */
export class GetAttachmentUseCase {
  private readonly store: AttachmentStorePort;

  public constructor(store: AttachmentStorePort) {
    this.store = store;
  }

  public async execute(rawInput: unknown): Promise<OpenedAttachment> {
    const parsed = inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('abrir anexo', flat.fieldErrors, flat.formErrors);
    }
    const found = await this.store.get(parsed.data.userId, parsed.data.attachmentId);
    if (found === null) throw new AttachmentNotFoundError();
    return { name: found.name, mediaType: found.mediaType, bytes: found.bytes };
  }
}
