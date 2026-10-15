import { DomainError } from '../shared/domain.error.ts';

/**
 * Lancado quando o `transferGroupId` informado (editar/excluir uma transferencia, spec 016,
 * RF-5) nao corresponde a nenhuma transacao, ou corresponde a transacoes que nao pertencem
 * ao usuario.
 */
export class TransferNotFoundError extends DomainError {
  public constructor() {
    super('TRANSFER_NOT_FOUND', 'transferencia nao encontrada');
  }
}
