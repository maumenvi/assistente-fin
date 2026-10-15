import { DomainError } from '../../../domain/shared/domain.error.ts';

/** O texto nao coube na area de transferencia do sistema (spec 029, R6). */
export class ClipboardTooLargeError extends DomainError {
  public constructor() {
    super('CLIPBOARD_TOO_LARGE', 'texto grande demais para a area de transferencia');
  }
}
