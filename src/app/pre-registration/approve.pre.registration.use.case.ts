import { z } from 'zod';
import { Transaction } from '../../domain/transaction/transaction.entity.ts';
import { AccountArchivedError } from '../../domain/account/account.archived.error.ts';
import { AccountNotFoundError } from '../../domain/account/account.not.found.error.ts';
import { PreRegistrationNotFoundError } from '../../domain/pre-registration/pre.registration.not.found.error.ts';
import { PreRegistrationIncompleteError } from '../../domain/pre-registration/pre.registration.incomplete.error.ts';
import { PossibleDuplicateError } from '../../domain/pre-registration/possible.duplicate.error.ts';
import { InvalidPreRegistrationError } from '../../domain/pre-registration/invalid.pre.registration.error.ts';
import { type PreRegistration } from '../../domain/pre-registration/pre.registration.entity.ts';
import { type Database } from '../shared/database.port.ts';
import { type DeterministicIdGenerator } from '../shared/deterministic.id.generator.port.ts';
import { type Clock } from '../shared/clock.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { RecordTransactionUseCase } from '../transaction/record.transaction.use.case.ts';
import { RecordInstallmentPurchaseUseCase } from '../transaction/record.installment.purchase.use.case.ts';
import { DerivedIdGenerator } from './derived.id.generator.ts';
import { approvePreRegistrationInputSchema } from './approve.pre.registration.input.schema.ts';

/** Observacao do lancamento: descricao, observacao do pre-registro e o aparelho que aprovou. */
function composeNotes(pre: PreRegistration, approvingDevice: string | undefined): string | undefined {
  const parts = [pre.description, pre.notes, approvingDevice ? `Aprovado no celular ${approvingDevice}` : null].filter(
    (part): part is string => part !== null && part !== '',
  );
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

/**
 * Caso de uso "aprovar pre-registro" (spec 022, FR-024/FR-025/FR-027). Numa unica transacao:
 * confere os campos obrigatorios, a conta (existe e nao esta arquivada) e a possivel duplicata;
 * cria o lancamento pelos MESMOS casos de uso do app (parcelado quando `installments > 1`),
 * com ids derivados do pre-registro; confirma lendo de volta; so entao apaga o pre-registro e
 * seus anexos. Qualquer falha desfaz tudo - nunca os dois, nunca nenhum.
 */
export class ApprovePreRegistrationUseCase {
  private readonly database: Database;
  private readonly deterministicIds: DeterministicIdGenerator;
  private readonly clock: Clock;

  public constructor(database: Database, deterministicIds: DeterministicIdGenerator, clock: Clock) {
    this.database = database;
    this.deterministicIds = deterministicIds;
    this.clock = clock;
  }

  public async execute(rawInput: unknown): Promise<Transaction[]> {
    const parsed = approvePreRegistrationInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('aprovar pre-registro', flat.fieldErrors, flat.formErrors);
    }
    const { userId, id, confirmDuplicate, approvingDevice } = parsed.data;

    return this.database.transaction(async (tx) => {
      const pre = await tx.preRegistrations.findById(userId, id);
      if (!pre) throw new PreRegistrationNotFoundError();
      const missing = pre.missingForApproval();
      if (missing.length > 0) throw new PreRegistrationIncompleteError(missing);
      const { amount, date, accountId } = pre;
      if (amount === null || date === null || accountId === null) throw new PreRegistrationIncompleteError(missing);

      const account = await tx.accounts.findById(userId, accountId);
      if (!account) throw new AccountNotFoundError();
      if (account.archived) throw new AccountArchivedError();
      if (confirmDuplicate !== true) {
        if (pre.possibleDuplicateOf !== null) throw new PossibleDuplicateError(pre.possibleDuplicateOf);
        // lancamento igual no mesmo dia (regra CA-5 do registro) tambem vira pergunta, nao erro seco
        const same = await tx.transactions.findDuplicate(
          Transaction.create({
            id: 'candidato',
            userId,
            date,
            amount,
            type: 'expense',
            categoryId: pre.categoryId ?? 'qualquer',
            accountId,
          }),
        );
        if (same) throw new PossibleDuplicateError(same.id);
      }

      const ids = new DerivedIdGenerator(pre.id, this.deterministicIds);
      const notes = composeNotes(pre, approvingDevice);
      const base = {
        userId,
        amountCents: amount.cents,
        date: date.toISOString(),
        ...(pre.categoryId !== null ? { categoryId: pre.categoryId } : {}),
        ...(notes !== undefined ? { notes } : {}),
      };
      let created: Transaction[];
      if ((pre.installments ?? 1) > 1) {
        if (account.kind !== 'credit-card') {
          throw new InvalidPreRegistrationError('parcelamento so em conta do tipo cartao de credito');
        }
        created = await new RecordInstallmentPurchaseUseCase(tx, ids).execute({
          ...base,
          accountId,
          installments: pre.installments,
        });
      } else {
        created = [
          await new RecordTransactionUseCase(tx, ids).execute(
            { ...base, type: 'expense', accountId },
            { allowDuplicate: confirmDuplicate === true },
          ),
        ];
      }

      for (const transaction of created) {
        if (!(await tx.transactions.findById(userId, transaction.id))) {
          throw new Error('lancamento nao confirmado apos gravar; aprovacao desfeita');
        }
      }
      await tx.captureAttachments.deleteByPreRegistration(userId, pre.id);
      await tx.preRegistrations.delete(userId, pre.id);
      // spec 027 (FR-004): a compra fica marcada como aprovada - uma reentrega nao a recria
      // spec 028: varias chaves de notificacao podem apontar para o mesmo pre-registro - todas resolvem
      for (const receipt of await tx.captureReceipts.listByPreRegistration(userId, pre.id)) {
        await tx.captureReceipts.save(receipt.resolve('approved', this.clock.now()));
      }
      // spec 027 (R6): um "nao encontrado" depois disto sabe dizer que a compra ja foi lancada
      await tx.preRegistrationOutcomes.record({
        userId,
        preRegistrationId: pre.id,
        outcome: 'approved',
        transactionId: created[0]?.id ?? null,
        at: this.clock.now(),
      });
      return created;
    });
  }
}
