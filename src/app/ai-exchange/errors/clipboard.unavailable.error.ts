import { DomainError } from '../../../domain/shared/domain.error.ts';

/** O aparelho nao oferece a area de transferencia (ex.: build sem o modulo nativo). */
export class ClipboardUnavailableError extends DomainError {
  public constructor() {
    super('CLIPBOARD_UNAVAILABLE', 'area de transferencia indisponivel neste aparelho');
  }
}
