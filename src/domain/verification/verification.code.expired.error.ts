import { DomainError } from '../shared/domain.error.ts';

/** Lancado ao confirmar um `VerificationCode` depois do prazo de validade (spec 001, CA-23). */
export class VerificationCodeExpiredError extends DomainError {
  public constructor() {
    super('VERIFICATION_CODE_EXPIRED', 'codigo de verificacao expirado');
  }
}
