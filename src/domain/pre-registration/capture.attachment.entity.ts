import { isValidOptionalDate } from '../shared/is.valid.optional.date.ts';
import { CAPTURE_ATTACHMENT_KINDS, type CaptureAttachmentKind } from './capture.attachment.kind.ts';
import { InvalidPreRegistrationError } from './invalid.pre.registration.error.ts';

/** Dados de um anexo de captura. */
export interface CaptureAttachmentProps {
  readonly id: string;
  readonly userId: string;
  readonly preRegistrationId: string;
  readonly kind: CaptureAttachmentKind;
  /** So em `image`. */
  readonly mimeType?: string | null | undefined;
  /** Texto (notificacao, fala, OCR). */
  readonly content?: string | null | undefined;
  /** Referencia do arquivo da imagem no armazenamento do aparelho. */
  readonly fileRef?: string | null | undefined;
  /** Integridade e deduplicacao (obrigatorio). */
  readonly sha256: string;
  readonly createdAt: Date;
}

/**
 * Anexo de uma captura (spec 022, FR-022): a foto da nota/comprovante, o texto original da
 * notificacao da carteira, o texto da fala ou do OCR. Pertence a um pre-registro e some com ele.
 */
export class CaptureAttachment {
  public readonly id: string;
  public readonly userId: string;
  public readonly preRegistrationId: string;
  public readonly kind: CaptureAttachmentKind;
  public readonly mimeType: string | null;
  public readonly content: string | null;
  public readonly fileRef: string | null;
  public readonly sha256: string;
  public readonly createdAt: Date;

  private constructor(props: CaptureAttachmentProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.preRegistrationId = props.preRegistrationId;
    this.kind = props.kind;
    this.mimeType = props.mimeType ?? null;
    this.content = props.content ?? null;
    this.fileRef = props.fileRef ?? null;
    this.sha256 = props.sha256;
    this.createdAt = props.createdAt;
  }

  /** Cria (ou reconstroi) um anexo, validando as invariantes. */
  public static create(props: CaptureAttachmentProps): CaptureAttachment {
    if (props.id.trim() === '' || props.userId.trim() === '' || props.preRegistrationId.trim() === '') {
      throw new InvalidPreRegistrationError('anexo sem id, usuario ou pre-registro');
    }
    if (!CAPTURE_ATTACHMENT_KINDS.includes(props.kind)) {
      throw new InvalidPreRegistrationError(`tipo de anexo desconhecido: ${String(props.kind)}`);
    }
    if (props.kind === 'image' && (props.mimeType ?? '').trim() === '') {
      throw new InvalidPreRegistrationError('imagem precisa de mimeType');
    }
    if (props.kind !== 'image' && props.mimeType) {
      throw new InvalidPreRegistrationError('mimeType so vale para imagem');
    }
    if (props.kind === 'image' && !props.fileRef) {
      throw new InvalidPreRegistrationError('imagem precisa do arquivo');
    }
    if (props.kind !== 'image' && !props.content) {
      throw new InvalidPreRegistrationError('anexo de texto precisa do conteudo');
    }
    if (!/^[0-9a-f]{64}$/.test(props.sha256)) {
      throw new InvalidPreRegistrationError('sha256 invalido');
    }
    if (!isValidOptionalDate(props.createdAt)) throw new InvalidPreRegistrationError('createdAt invalido');
    return new CaptureAttachment(props);
  }

  /** Alias de `create` para os adaptadores de banco. */
  public static fromPersistence(props: CaptureAttachmentProps): CaptureAttachment {
    return CaptureAttachment.create(props);
  }
}
