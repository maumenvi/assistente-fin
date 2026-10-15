import { type CaptureAttachment } from '../../domain/pre-registration/capture.attachment.entity.ts';

/** Porta de persistencia dos anexos de captura (spec 022). */
export interface CaptureAttachmentRepository {
  save(attachment: CaptureAttachment): Promise<void>;
  findById(userId: string, id: string): Promise<CaptureAttachment | null>;
  delete(userId: string, id: string): Promise<void>;
  listByPreRegistration(userId: string, preRegistrationId: string): Promise<CaptureAttachment[]>;
  /** Remove todos os anexos de um pre-registro (aprovado ou descartado). */
  deleteByPreRegistration(userId: string, preRegistrationId: string): Promise<void>;
}
