import { DomainError } from '../shared/domain.error.ts';

/** Lancado quando o telefone informado ja esta vinculado a outro usuario (RF-23). */
export class PhoneAlreadyRegisteredError extends DomainError {
  public constructor() {
    super('PHONE_ALREADY_REGISTERED', 'telefone ja cadastrado');
  }
}
