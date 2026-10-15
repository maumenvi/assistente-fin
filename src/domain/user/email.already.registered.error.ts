import { DomainError } from '../shared/domain.error.ts';

/** Lancado quando o e-mail informado ja esta vinculado a outro usuario (RF-23). */
export class EmailAlreadyRegisteredError extends DomainError {
  public constructor() {
    super('EMAIL_ALREADY_REGISTERED', 'e-mail ja cadastrado');
  }
}
