import { DomainError } from '../shared/domain.error.ts';

/**
 * Lancado quando `UpdateTransferUseCase`/`UpdateCardPaymentUseCase` (spec 016, decisao do
 * usuario) recebe uma tentativa de mudar o valor ou as contas de uma transferencia/pagamento
 * de fatura ja criado. So metadados compartilhados (data, notas) sao editaveis em conjunto -
 * mudar valor ou contas exige excluir e recriar atomicamente, nunca um update parcial que
 * poderia deixar as duas pontas divergentes.
 */
export class TransferAmountChangeNotAllowedError extends DomainError {
  public constructor() {
    super(
      'TRANSFER_AMOUNT_CHANGE_NOT_ALLOWED',
      'valor e contas de uma transferencia/pagamento nao podem ser editados - exclua e recrie',
    );
  }
}
