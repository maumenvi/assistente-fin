import { z } from 'zod';
import { TransactionNotFoundError } from '../../domain/transaction/transaction.not.found.error.ts';
import { NotAnInstallmentError } from '../../domain/transaction/not.an.installment.error.ts';
import { type TransactionRepository } from './transaction.repository.port.ts';
import { type Clock } from '../shared/clock.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { cancelRemainingInstallmentsInputSchema } from './cancel.remaining.installments.input.schema.ts';

/** Resultado de `CancelRemainingInstallmentsUseCase`: quantas parcelas foram canceladas. */
export interface CancelRemainingInstallmentsResult {
  readonly cancelledCount: number;
}

/**
 * Caso de uso "cancelar parcelas restantes de uma compra parcelada" (spec 009, RF-8, RF-9).
 *
 * A partir de qualquer parcela do grupo (`transactionId`), busca a transacao no escopo do
 * usuario (`TransactionNotFoundError` se ausente/de outro usuario, CA-14) e confirma que ela
 * e mesmo uma parcela (`installmentGroupId` nao nulo - `NotAnInstallmentError` caso
 * contrario). Busca todas as parcelas do grupo via `listByInstallmentGroup` e exclui apenas
 * as que ainda **nao** venceram: `Transaction.date` estritamente posterior a `Clock.now()`
 * (decisao 4.3 do plano - comparacao direta contra a data da propria parcela, sem depender
 * do calculo de ciclo de fatura do cartao, mantendo este caso de uso desacoplado de
 * `credit.card.billing.period.ts`).
 *
 * Exclui em loop chamando `transactions.delete` (decisao 4.4 - sem `deleteMany` no port,
 * volume esperado por grupo e pequeno). Devolve quantas parcelas foram removidas
 * (`cancelledCount: 0` se todas ja tinham vencido).
 */
export class CancelRemainingInstallmentsUseCase {
  private readonly transactions: TransactionRepository;
  private readonly clock: Clock;

  public constructor(transactions: TransactionRepository, clock: Clock) {
    this.transactions = transactions;
    this.clock = clock;
  }

  public async execute(rawInput: unknown): Promise<CancelRemainingInstallmentsResult> {
    const parsed = cancelRemainingInstallmentsInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('cancelar parcelas restantes', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const reference = await this.transactions.findById(input.userId, input.transactionId);
    if (!reference) {
      throw new TransactionNotFoundError();
    }
    if (reference.installmentGroupId === null) {
      throw new NotAnInstallmentError();
    }

    const installments = await this.transactions.listByInstallmentGroup(
      input.userId,
      reference.installmentGroupId,
    );
    const now = this.clock.now();
    const notDue = installments.filter((installment) => installment.date.getTime() > now.getTime());

    for (const installment of notDue) {
      await this.transactions.delete(input.userId, installment.id);
    }

    return { cancelledCount: notDue.length };
  }
}
