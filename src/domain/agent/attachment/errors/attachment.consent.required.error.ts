import { AgentError } from '../../errors/agent.error.ts';

/** Anexo para modelo de nuvem sem o consentimento especifico de anexos. */
export class AttachmentConsentRequiredError extends AgentError {
  public constructor() {
    super('ATTACHMENT_CONSENT_REQUIRED', 'consentimento de anexos necessario');
  }
}
