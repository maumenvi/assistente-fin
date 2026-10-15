import { Money } from '../shared/money.value.object.ts';
import { Recurrence } from '../shared/recurrence.value.object.ts';
import { isValidOptionalDate } from '../shared/is.valid.optional.date.ts';
import { TRANSACTION_TYPES, type TransactionType } from './transaction.type.ts';
import { InvalidTransactionError } from './invalid.transaction.error.ts';

/** Comprimento maximo de textos livres (notes). */
/** Limite das observacoes: cabe o link de consulta da NFC-e (spec 022, FR-033). */
const MAX_TEXT_LENGTH = 500;

/** Dados necessarios para criar uma transacao. */
export interface CreateTransactionProps {
  readonly id: string;
  readonly userId: string;
  readonly date: Date;
  readonly amount: Money;
  readonly type: TransactionType;
  /**
   * Id da categoria do usuario (spec 003, RF-10). Sempre presente: quando o usuario nao
   * informa nada, o app resolve para a categoria padrao (`resolveCategoryId`), e e esse
   * vinculo - nao a ausencia de valor - que marca a transacao como pendente (RF-14).
   */
  readonly categoryId: string;
  readonly accountId: string;
  readonly notes?: string | undefined;
  /** Recorrencia da transacao (spec 003, RF-16). Ausente => `Recurrence.none()` (evento unico). */
  readonly recurrence?: Recurrence | undefined;
  /** Id da serie que gerou esta ocorrencia (spec 003, RF-26); `null` = avulsa ou desanexada. */
  readonly seriesId?: string | null | undefined;
  /**
   * Vinculo de parcela de compra parcelada no cartao de credito (spec 009, RF-4). Os tres
   * campos abaixo sao nulos juntos (lancamento comum) ou preenchidos juntos (parcela) -
   * nunca parcial, reforcado em `build()`.
   */
  readonly installmentGroupId?: string | null | undefined;
  /** Posicao 1-based da parcela dentro do grupo (ex.: 3 em "3 de 12"). */
  readonly installmentNumber?: number | null | undefined;
  /** Total de parcelas do grupo (>= 2 - 1 parcela nao usa esse mecanismo, RF-10/CA-9). */
  readonly installmentTotal?: number | null | undefined;
  /**
   * Id do `Income` de origem (spec 012, RF-3/RF-5, Q2). `null`/ausente = transacao avulsa,
   * sem vinculo com nenhum ganho (a esmagadora maioria). 1:N - varias `Transaction` (uma por
   * mes lancado) podem apontar para o mesmo `Income`. O dominio nao verifica que o `Income`
   * existe (rule 10) - isso e responsabilidade do caso de uso (`LaunchIncomeMonthUseCase`).
   */
  readonly incomeId?: string | null | undefined;
  /**
   * Id do `FixedExpense` de origem (spec 015). `null`/ausente = transacao avulsa. 1:1 (nao
   * 1:N como `incomeId`): `FixedExpense.paid` e uma flag unica sem nocao de mes, entao so
   * existe no maximo uma `Transaction` "ativa" vinculada por gasto fixo por vez -
   * `SetFixedExpensePaidUseCase` cria ao marcar pago e remove ao desmarcar. O dominio nao
   * verifica que o `FixedExpense` existe (rule 10).
   */
  readonly fixedExpenseId?: string | null | undefined;
  /**
   * Id do par de transferencia (spec 016, RF-5). `null`/ausente = transacao avulsa. As duas
   * pontas de uma transferencia (saida na origem, entrada no destino) compartilham o mesmo
   * `transferGroupId`, gerado pela operacao nativa (`CreateTransferUseCase`) - analogo a
   * `installmentGroupId`, mas sempre exatamente 2 transacoes por grupo, nunca N. O dominio nao
   * verifica que a outra ponta existe (rule 10) - isso e responsabilidade do caso de uso.
   */
  readonly transferGroupId?: string | null | undefined;
  /**
   * Id do par de pagamento de fatura de cartao (spec 016, RF-6). `null`/ausente = transacao
   * avulsa. Mesma mecanica de `transferGroupId`, mas para as duas pontas de um pagamento de
   * fatura (saida na conta pagadora, baixa da divida no cartao) - nunca a mesma categoria/
   * operacao de `transferGroupId` (cartao de credito nao e conta de saldo, decisao de modelo
   * da spec 016).
   */
  readonly cardPaymentGroupId?: string | null | undefined;
}

/** Dados de uma transacao ja persistida: iguais aos de criacao + a versao da trava otimista. */
export interface TransactionPersistenceProps extends CreateTransactionProps {
  /** Versao para trava otimista (spec 002, RF-31). `null`/ausente = nunca persistida. */
  readonly updatedAt?: Date | null;
}

/**
 * Transacao manual (spec 001, RF-5, RF-6).
 *
 * Imutavel. Toda transacao tem categoria (spec 003, RF-10): "pendente de classificacao"
 * deixou de ser um estado da entidade e passou a ser derivado no app (vinculo com a categoria
 * padrao do usuario), porque so o app sabe qual e a padrao. Deduplicacao (CA-5) e feita fora
 * daqui - por `TransactionRepository.findDuplicate` - porque exige comparar com o que ja
 * esta persistido.
 */
export class Transaction {
  public readonly id: string;
  public readonly userId: string;
  public readonly date: Date;
  public readonly amount: Money;
  public readonly type: TransactionType;
  public readonly categoryId: string;
  public readonly accountId: string;
  public readonly notes: string | undefined;
  public readonly recurrence: Recurrence;
  public readonly seriesId: string | null;
  public readonly installmentGroupId: string | null;
  public readonly installmentNumber: number | null;
  public readonly installmentTotal: number | null;
  /** Id do `Income` de origem (spec 012, RF-3/RF-5); `null` = transacao avulsa. */
  public readonly incomeId: string | null;
  /** Id do `FixedExpense` de origem (spec 015); `null` = transacao avulsa. */
  public readonly fixedExpenseId: string | null;
  /** Id do par de transferencia (spec 016, RF-5); `null` = transacao avulsa. */
  public readonly transferGroupId: string | null;
  /** Id do par de pagamento de fatura de cartao (spec 016, RF-6); `null` = transacao avulsa. */
  public readonly cardPaymentGroupId: string | null;
  /** Versao lida do banco (trava otimista, RF-31); `null` enquanto nao foi persistida. */
  public readonly updatedAt: Date | null;

  private constructor(props: TransactionPersistenceProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.date = props.date;
    this.amount = props.amount;
    this.type = props.type;
    this.categoryId = props.categoryId;
    this.accountId = props.accountId;
    this.notes = props.notes;
    this.recurrence = props.recurrence ?? Recurrence.none();
    this.seriesId = props.seriesId ?? null;
    this.installmentGroupId = props.installmentGroupId ?? null;
    this.installmentNumber = props.installmentNumber ?? null;
    this.installmentTotal = props.installmentTotal ?? null;
    this.incomeId = props.incomeId ?? null;
    this.fixedExpenseId = props.fixedExpenseId ?? null;
    this.transferGroupId = props.transferGroupId ?? null;
    this.cardPaymentGroupId = props.cardPaymentGroupId ?? null;
    this.updatedAt = props.updatedAt ?? null;
  }

  /** Se esta transacao e uma parcela de uma compra parcelada (spec 009, RF-4). */
  public isInstallment(): boolean {
    return this.installmentGroupId !== null;
  }

  public static create(props: CreateTransactionProps): Transaction {
    return Transaction.build(props);
  }

  /**
   * Reconstroi uma transacao ja persistida, reaplicando as mesmas invariantes de `create`.
   * Permite `amount` negativo na releitura (mas nunca zero): um valor negativo so chega ao
   * banco por ter passado antes por `createAdjustment` (spec 015), entao a releitura nao deve
   * rejeitar o que a propria fabrica ja aceitou uma vez.
   */
  public static fromPersistence(props: TransactionPersistenceProps): Transaction {
    return Transaction.build(props, { allowNegativeAmount: true });
  }

  /**
   * Cria o lancamento de ajuste de saldo/gasto inicial (spec 015, `UpdateAccountUseCase`):
   * unico caso em que `amount` pode ser negativo (estorno) - necessario para que uma reducao
   * de despesa conte corretamente no calculo de fatura/limite de cartao de credito
   * (`listExpensesByAccountAndDateRange` soma `amount` de todo `type: 'expense'` no periodo; um
   * estorno so "desconta" dali se for negativo). Continua exigindo `type: 'expense'` e
   * `amount` diferente de zero - so a restricao de positividade e relaxada. Nao ha campo novo
   * persistido: a `Transaction` resultante e indistinguivel de uma comum, exceto pelo sinal do
   * valor guardado.
   */
  public static createAdjustment(props: CreateTransactionProps & { readonly type: 'expense' }): Transaction {
    return Transaction.build(props, { allowNegativeAmount: true });
  }

  /** Devolve a mesma transacao com outro `updatedAt` - usado pelos adaptadores ao (re)carimbar. */
  public withUpdatedAt(updatedAt: Date | null): Transaction {
    return new Transaction({ ...this.props(), updatedAt });
  }

  private static build(
    props: TransactionPersistenceProps,
    options: { readonly allowNegativeAmount?: boolean } = {},
  ): Transaction {
    const id = props.id.trim();
    const userId = props.userId.trim();
    const accountId = props.accountId.trim();
    const categoryId = props.categoryId.trim();
    const notes = props.notes?.trim();

    if (id === '') throw new InvalidTransactionError('id obrigatorio');
    if (userId === '') throw new InvalidTransactionError('userId obrigatorio');
    if (!(props.date instanceof Date) || Number.isNaN(props.date.getTime())) {
      throw new InvalidTransactionError('date deve ser uma data valida');
    }
    if (!(props.amount instanceof Money)) {
      throw new InvalidTransactionError('amount deve ser Money');
    }
    if (props.amount.isZero() || (props.amount.isNegative() && !options.allowNegativeAmount)) {
      throw new InvalidTransactionError('amount deve ser positivo');
    }
    if (!TRANSACTION_TYPES.includes(props.type)) {
      throw new InvalidTransactionError(`type desconhecido: ${String(props.type)}`);
    }
    if (categoryId === '') throw new InvalidTransactionError('categoryId obrigatorio');
    if (accountId === '') throw new InvalidTransactionError('accountId obrigatorio');
    if (notes !== undefined && notes.length > MAX_TEXT_LENGTH) {
      throw new InvalidTransactionError(`notes acima de ${MAX_TEXT_LENGTH} caracteres`);
    }
    if (!isValidOptionalDate(props.updatedAt)) {
      throw new InvalidTransactionError('updatedAt deve ser null ou uma data valida');
    }
    if (props.recurrence !== undefined && !(props.recurrence instanceof Recurrence)) {
      throw new InvalidTransactionError('recurrence deve ser Recurrence');
    }
    const seriesId = props.seriesId?.trim() ?? null;
    if (seriesId === '') {
      throw new InvalidTransactionError('seriesId, se informado, nao pode ser vazio');
    }
    const incomeId = props.incomeId?.trim() ?? null;
    if (incomeId === '') {
      throw new InvalidTransactionError('incomeId, se informado, nao pode ser vazio');
    }
    const fixedExpenseId = props.fixedExpenseId?.trim() ?? null;
    if (fixedExpenseId === '') {
      throw new InvalidTransactionError('fixedExpenseId, se informado, nao pode ser vazio');
    }
    const transferGroupId = props.transferGroupId?.trim() ?? null;
    if (transferGroupId === '') {
      throw new InvalidTransactionError('transferGroupId, se informado, nao pode ser vazio');
    }
    const cardPaymentGroupId = props.cardPaymentGroupId?.trim() ?? null;
    if (cardPaymentGroupId === '') {
      throw new InvalidTransactionError('cardPaymentGroupId, se informado, nao pode ser vazio');
    }

    const installmentGroupId = props.installmentGroupId?.trim() ?? null;
    const installmentNumber = props.installmentNumber ?? null;
    const installmentTotal = props.installmentTotal ?? null;
    const installmentFields = [installmentGroupId, installmentNumber, installmentTotal];
    const allInstallmentFieldsPresent = installmentFields.every((field) => field !== null);
    const noInstallmentFieldsPresent = installmentFields.every((field) => field === null);
    if (!allInstallmentFieldsPresent && !noInstallmentFieldsPresent) {
      throw new InvalidTransactionError(
        'campos de parcela (installmentGroupId/installmentNumber/installmentTotal) devem ser preenchidos todos juntos ou nenhum',
      );
    }
    if (allInstallmentFieldsPresent) {
      if (installmentGroupId === '') {
        throw new InvalidTransactionError('installmentGroupId nao pode ser vazio');
      }
      if (!Number.isInteger(installmentTotal) || installmentTotal! < 2) {
        throw new InvalidTransactionError('installmentTotal deve ser um inteiro >= 2');
      }
      if (
        !Number.isInteger(installmentNumber) ||
        installmentNumber! < 1 ||
        installmentNumber! > installmentTotal!
      ) {
        throw new InvalidTransactionError('installmentNumber fora do intervalo valido (1..installmentTotal)');
      }
    }

    return new Transaction({
      id,
      userId,
      date: props.date,
      amount: props.amount,
      type: props.type,
      categoryId,
      accountId,
      notes: notes === '' ? undefined : notes,
      recurrence: props.recurrence ?? Recurrence.none(),
      seriesId,
      installmentGroupId,
      installmentNumber,
      installmentTotal,
      incomeId,
      fixedExpenseId,
      transferGroupId,
      cardPaymentGroupId,
      updatedAt: props.updatedAt ?? null,
    });
  }

  private props(): TransactionPersistenceProps {
    return {
      id: this.id,
      userId: this.userId,
      date: this.date,
      amount: this.amount,
      type: this.type,
      categoryId: this.categoryId,
      accountId: this.accountId,
      notes: this.notes,
      recurrence: this.recurrence,
      seriesId: this.seriesId,
      installmentGroupId: this.installmentGroupId,
      installmentNumber: this.installmentNumber,
      installmentTotal: this.installmentTotal,
      incomeId: this.incomeId,
      fixedExpenseId: this.fixedExpenseId,
      transferGroupId: this.transferGroupId,
      cardPaymentGroupId: this.cardPaymentGroupId,
      updatedAt: this.updatedAt,
    };
  }
}
