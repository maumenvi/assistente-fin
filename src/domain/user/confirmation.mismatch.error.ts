import { DomainError } from '../shared/domain.error.ts';

/**
 * Lancado quando o CPF digitado na confirmacao de "redefinir acesso localmente" nao bate com
 * o do usuario-alvo (spec 002, RF-9e, CA-9k). Guard minimo do dominio - o bloqueio real
 * (avisos em etapas) esta na borda.
 */
export class ConfirmationMismatchError extends DomainError {
  public constructor() {
    super('CONFIRMATION_MISMATCH', 'a confirmacao nao bate com o usuario');
  }
}
