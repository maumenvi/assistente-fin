import { DomainError } from '../shared/domain.error.ts';

/**
 * Lancado quando um `VerificationCode` viola uma invariante de construcao (dados corrompidos
 * ao reconstituir do banco), ou quando o codigo que o usuario digitou nao bate com o
 * armazenado (`ConfirmVerificationUseCase`, spec 001, CA-23).
 */
export class InvalidVerificationCodeError extends DomainError {
  public constructor(reason: string) {
    super('INVALID_VERIFICATION_CODE', `codigo de verificacao invalido: ${reason}`);
  }
}
