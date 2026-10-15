import { z } from 'zod';
import { Transaction } from '../../domain/transaction/transaction.entity.ts';
import { Money } from '../../domain/shared/money.value.object.ts';
import { TransactionNotFoundError } from '../../domain/transaction/transaction.not.found.error.ts';
import { AccountNotFoundError } from '../../domain/account/account.not.found.error.ts';
import { AccountArchivedError } from '../../domain/account/account.archived.error.ts';
import { StructuralTransactionEditNotAllowedError } from '../../domain/transaction/structural.transaction.edit.not.allowed.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { resolveCategoryIdOrKeep } from '../category/resolve.category.id.or.keep.ts';
import { type Database } from '../shared/database.port.ts';
import { updateTransactionInputSchema, type UpdateTransactionInput } from './update.transaction.input.schema.ts';
import {
  propagateInstallmentFields,
  type InstallmentPropagation,
} from './propagate.installment.fields.ts';

/**
 * Caso de uso "atualizar transacao" (spec 002, RF-20, RF-31, plan.md decisao 12).
 *
 * `TransactionNotFoundError` fora do escopo do usuario (CA-14). Reconstroi via
 * `Transaction.create` com o mesmo id, mesclando os campos enviados - **NAO** roda
 * `findDuplicate` (CA-5): e edicao deliberada de um registro que ja existe, nao um
 * lancamento novo. Categoria ausente na entrada = mantem a que ja esta la (spec 003); para
 * marcar como pendente de novo, aponte explicitamente para a categoria padrao.
 * `withUpdatedAt(expectedUpdatedAt ?? existing.updatedAt)` -> trava otimista no save.
 *
 * Se a transacao pertence a uma serie (`seriesId != null`), editar UMA ocorrencia a
 * **desanexa** da serie (spec 003, RF-27, CA-19): o `seriesId` vai a `null` e a ocorrencia
 * passa a ser um lancamento avulso. As demais ocorrencias e o molde da serie ficam intactos;
 * "prolongar"/"encerrar" a serie dali em diante ja nao a alcancam.
 *
 * `accountId` (spec 005, RF-7/RF-8) permite trocar a conta do lancamento. Quando informado
 * e diferente da conta atual, valida que a conta existe e pertence ao usuario
 * (`AccountNotFoundError`, mesma semantica de isolamento de `RecordTransactionUseCase`) e
 * que nao esta arquivada (`AccountArchivedError`, CA-10) - diferente da criacao, que nao
 * valida arquivamento (assimetria aceita, spec 005 secao 4.2).
 *
 * **Nao mexe em transacao estruturalmente vinculada** (`StructuralTransactionEditNotAllowedError`,
 * achado do bug de saldo inicial/forecast divergente): tentar mudar `amountCents`/`accountId`/
 * `type` de uma perna de transferencia (`transferGroupId`) ou de pagamento de fatura
 * (`cardPaymentGroupId`), ou `amountCents`/`date` do "SALDO INICIAL" de uma conta
 * (`isSystemOpeningBalance`), e rejeitado - cada um tem um caminho proprio que mantem as
 * fontes em sincronia (`UpdateTransferUseCase`, `UpdateCardPaymentUseCase`,
 * `UpdateAccountUseCase`); passar por aqui quebraria essa sincronia silenciosamente. `notes`
 * continua editavel livremente em qualquer uma (metadado, nao estrutural).
 */
export class UpdateTransactionUseCase {
  private readonly database: Database;
  private readonly ids: IdGenerator;

  public constructor(database: Database, ids: IdGenerator) {
    this.database = database;
    this.ids = ids;
  }

  public async execute(rawInput: unknown): Promise<Transaction> {
    const parsed = updateTransactionInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('atualizar transacao', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    // spec 020 (RF-51b): a edicao inteira - a parcela editada MAIS a propagacao pras irmas -
    // corre dentro de uma transacao de banco. Ou tudo e gravado, ou nada e, e o erro sobe pra
    // borda. Nunca um grupo meio atualizado (RF-51a exige que nao exista essa divergencia).
    return this.database.transaction(async (tx) => this.executeWithin(tx, input));
  }

  private async executeWithin(
    tx: Database,
    input: UpdateTransactionInput,
  ): Promise<Transaction> {
    const existing = await tx.transactions.findById(input.userId, input.id);
    if (!existing) {
      throw new TransactionNotFoundError();
    }

    await this.assertStructuralFieldsUntouched(tx, input, existing);

    const categoryId = await resolveCategoryIdOrKeep(
      tx.categories,
      this.ids,
      input,
      existing.categoryId,
    );

    let accountId = existing.accountId;
    if (input.accountId !== undefined && input.accountId !== existing.accountId) {
      const account = await tx.accounts.findById(input.userId, input.accountId);
      if (!account) {
        throw new AccountNotFoundError();
      }
      if (account.archived) {
        throw new AccountArchivedError();
      }
      accountId = account.id;
    }

    const updated = Transaction.create({
      id: existing.id,
      userId: existing.userId,
      date: input.date !== undefined ? new Date(input.date) : existing.date,
      amount: input.amountCents !== undefined ? Money.fromCents(input.amountCents) : existing.amount,
      type: input.type ?? existing.type,
      categoryId,
      accountId,
      notes: input.notes !== undefined ? input.notes : existing.notes,
      // editar uma ocorrencia a desanexa da serie (RF-27, CA-19); um lancamento avulso
      // (fora de serie) preserva a recorrencia que ja tinha.
      recurrence: existing.seriesId !== null ? undefined : existing.recurrence,
      seriesId: null,
      // parcela de compra parcelada (spec 009, RF-7): editar so afeta este lancamento, mas
      // ele continua sendo a mesma parcela do mesmo grupo - preserva os tres campos, ao
      // contrario de seriesId (que e sempre desanexado acima).
      installmentGroupId: existing.installmentGroupId,
      installmentNumber: existing.installmentNumber,
      installmentTotal: existing.installmentTotal,
      // vinculo estrutural de transferencia/pagamento de fatura (spec 016) - preservado em
      // qualquer edicao permitida (ex: notes); `assertStructuralFieldsUntouched` ja rejeitou
      // qualquer tentativa de mudar amountCents/accountId/type nessas transacoes, entao so
      // falta nao deixar `Transaction.create` zerar o grupo por omissao (`props.x ?? null`).
      transferGroupId: existing.transferGroupId,
      cardPaymentGroupId: existing.cardPaymentGroupId,
    }).withUpdatedAt(
      input.expectedUpdatedAt !== undefined
        ? new Date(input.expectedUpdatedAt)
        : existing.updatedAt,
    );

    await tx.transactions.save(updated);

    // spec 020 (RF-51): categoria e notas sao atributos da COMPRA, nao da parcela - propaga
    // pras irmas do mesmo grupo. Valor, data e conta ficam so nesta (spec 009, RF-7).
    const propagation = propagateInstallmentFields(existing, {
      categoryId,
      notes: updated.notes,
      notesTouched: input.notes !== undefined,
    });
    if (propagation !== null && existing.installmentGroupId !== null) {
      await this.propagateToSiblings(tx, input.userId, existing.id, existing.installmentGroupId, propagation);
    }

    // rele a versao persistida: `save` recarimba o `updatedAt` (RF-31).
    return (await tx.transactions.findById(input.userId, input.id)) ?? updated;
  }

  /**
   * Aplica `propagation` a todas as parcelas do grupo, menos a que o usuario acabou de editar
   * (`editedId`, ja gravada com a trava otimista dela).
   *
   * A trava otimista NAO se aplica as irmas: o `expectedUpdatedAt` que chega da borda e o da
   * parcela que o usuario viu na tela, e as outras sao regravadas com o `updatedAt` lido aqui
   * dentro, na mesma transacao de banco. Escrita concorrente em qualquer uma delas derruba a
   * transacao inteira e nenhuma parcela e alterada (RF-51b).
   *
   * Sobrescreve **incondicionalmente** (RF-51a): parcela que tinha categoria ou notas
   * diferentes por edicao individual anterior tambem e alinhada, sem confirmacao.
   */
  private async propagateToSiblings(
    tx: Database,
    userId: string,
    editedId: string,
    groupId: string,
    propagation: InstallmentPropagation,
  ): Promise<void> {
    const group = await tx.transactions.listByInstallmentGroup(userId, groupId);
    for (const sibling of group) {
      if (sibling.id === editedId) continue;

      const aligned = Transaction.create({
        id: sibling.id,
        userId: sibling.userId,
        date: sibling.date,
        amount: sibling.amount,
        type: sibling.type,
        categoryId: propagation.categoryId ?? sibling.categoryId,
        accountId: sibling.accountId,
        notes: propagation.notes !== undefined ? propagation.notes : sibling.notes,
        recurrence: sibling.seriesId !== null ? undefined : sibling.recurrence,
        seriesId: sibling.seriesId,
        // a identidade da parcela nunca e reescrita pela propagacao
        installmentGroupId: sibling.installmentGroupId,
        installmentNumber: sibling.installmentNumber,
        installmentTotal: sibling.installmentTotal,
        transferGroupId: sibling.transferGroupId,
        cardPaymentGroupId: sibling.cardPaymentGroupId,
      }).withUpdatedAt(sibling.updatedAt);

      await tx.transactions.save(aligned);
    }
  }

  /**
   * Rejeita mudar campos estruturais (`amountCents`/`accountId`/`type`, e tambem `date` no
   * caso do saldo inicial) de uma transacao vinculada a uma transferencia, a um pagamento de
   * fatura, ou que e o "SALDO INICIAL" de uma conta - ver `StructuralTransactionEditNotAllowedError`.
   * `date`/`notes` continuam livres nos dois primeiros casos (replicados via
   * `UpdateTransferUseCase`/`UpdateCardPaymentUseCase`, nao aqui).
   */
  private async assertStructuralFieldsUntouched(
    tx: Database,
    input: {
      readonly amountCents?: number | undefined;
      readonly accountId?: string | undefined;
      readonly type?: string | undefined;
      readonly date?: string | undefined;
    },
    existing: Transaction,
  ): Promise<void> {
    const changesAmountAccountOrType =
      input.amountCents !== undefined ||
      (input.accountId !== undefined && input.accountId !== existing.accountId) ||
      (input.type !== undefined && input.type !== existing.type);

    if (changesAmountAccountOrType && existing.transferGroupId !== null) {
      throw new StructuralTransactionEditNotAllowedError('transfer');
    }
    if (changesAmountAccountOrType && existing.cardPaymentGroupId !== null) {
      throw new StructuralTransactionEditNotAllowedError('card-payment');
    }

    const changesAmountOrDate = input.amountCents !== undefined || input.date !== undefined;
    if (changesAmountOrDate) {
      const openingBalanceCategory = await tx.categories.findSystemOpeningBalance(existing.userId);
      if (openingBalanceCategory !== null && existing.categoryId === openingBalanceCategory.id) {
        throw new StructuralTransactionEditNotAllowedError('opening-balance');
      }
    }
  }
}
