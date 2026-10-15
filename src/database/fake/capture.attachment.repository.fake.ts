import { type CaptureAttachment } from '../../domain/pre-registration/capture.attachment.entity.ts';
import { type CaptureAttachmentRepository } from '../../app/pre-registration/capture.attachment.repository.port.ts';

/** `CaptureAttachmentRepository` em memoria (spec 022). */
export class FakeCaptureAttachmentRepository implements CaptureAttachmentRepository {
  private readonly byId = new Map<string, CaptureAttachment>();

  public async save(attachment: CaptureAttachment): Promise<void> {
    this.byId.set(attachment.id, attachment);
  }

  public async findById(userId: string, id: string): Promise<CaptureAttachment | null> {
    const found = this.byId.get(id);
    return found && found.userId === userId ? found : null;
  }

  public async delete(userId: string, id: string): Promise<void> {
    if (this.byId.get(id)?.userId === userId) this.byId.delete(id);
  }

  public async listByPreRegistration(userId: string, preRegistrationId: string): Promise<CaptureAttachment[]> {
    return [...this.byId.values()].filter((a) => a.userId === userId && a.preRegistrationId === preRegistrationId);
  }

  public async deleteByPreRegistration(userId: string, preRegistrationId: string): Promise<void> {
    for (const attachment of await this.listByPreRegistration(userId, preRegistrationId)) this.byId.delete(attachment.id);
  }
}
