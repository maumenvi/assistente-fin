import { DomainError } from '../shared/domain.error.ts';

/** Lancado ao tentar confirmar de novo um `VerificationCode` ja confirmado (spec 001, CA-23). */
export class VerificationCodeAlreadyConfirmedError extends DomainError {
  public constructor() {
    super('VERIFICATION_CODE_ALREADY_CONFIRMED', 'codigo de verificacao ja confirmado');
  }
}
