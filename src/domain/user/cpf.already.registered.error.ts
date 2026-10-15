import { DomainError } from '../shared/domain.error.ts';

/** Lancado quando o CPF informado ja esta vinculado a outro usuario (spec 001, CA-13). */
export class CpfAlreadyRegisteredError extends DomainError {
  public constructor() {
    super('CPF_ALREADY_REGISTERED', 'CPF ja cadastrado');
  }
}
