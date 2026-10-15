import { DomainError } from '../shared/domain.error.ts';

/**
 * Lancado quando `transaction.transfer` (spec 016, RF-3) recebe dados que já correspondem a
 * uma transferência existente: mesma conta de origem, mesma conta de destino, mesmo valor e
 * mesmo dia calendário das duas pernas já persistidas. Evita duplicar uma transferência por
 * reenvio (dupla submissão, retry de rede) - mesmo espírito de deduplicação de
 * `RecordTransactionUseCase` (`findDuplicate`, CA-5), aplicado às duas pernas de uma vez.
 */
export class DuplicateTransferError extends DomainError {
  public constructor() {
    super('DUPLICATE_TRANSFER', 'ja existe uma transferencia identica (mesma origem, destino, valor e data)');
  }
}
