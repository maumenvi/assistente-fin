import { Money } from '../shared/money.value.object.ts';
import { isValidOptionalDate } from '../shared/is.valid.optional.date.ts';
import { InvalidFixedExpenseError } from './invalid.fixed.expense.error.ts';

/** Dados necessarios para criar um gasto fixo. */
export interface CreateFixedExpenseProps {
  readonly id: string;
  readonly userId: string;
  readonly dueDay: number;
  /** Mes de referencia (1-12), opcional e informativo (spec 006, RF-1/RF-2). */
  readonly referenceMonth?: number | null | undefined;
  /** Descricao livre, opcional (spec 006, RF-4). */
  readonly description?: string | null | undefined;
  readonly expectedAmount: Money;
  /** Id da categoria do usuario (spec 003, RF-10). O nome vive no agregado `Category`. */
  readonly categoryId: string;
  readonly accountId: string;
}

/** Dados de um gasto fixo ja persistido, incluindo o status de pagamento. */
export interface FixedExpensePersistenceProps extends CreateFixedExpenseProps {
  readonly paid: boolean;
  /** Versao para trava otimista (spec 002, RF-31). `null`/ausente = nunca persistido. */
  readonly updatedAt?: Date | null;
}

/**
 * Gasto fixo (spec 001, RF-3, CA-3).
 *
 * Imutavel. Nasce sempre `paid: false` (ainda nao pago neste periodo); `markAsPaid`/
 * `markAsUnpaid` transicionam o status, `fromPersistence` aceita o estado ja persistido.
 *
 * Nao tem recorrencia (spec 003, RF-16a): a previsao ja projetava todo gasto fixo em todo
 * mes, independente da recorrencia - o campo era peso morto e saiu.
 *
 * `referenceMonth` (spec 006, RF-1) e puramente informativo/historico: `calculateMonthlyForecast`
 * nao o consulta (RF-2) - todo gasto fixo continua se aplicando a todo mes projetado.
 */
export class FixedExpense {
  public readonly id: string;
  public readonly userId: string;
  public readonly dueDay: number;
  public readonly referenceMonth: number | null;
  public readonly description: string | null;
  public readonly expectedAmount: Money;
  public readonly categoryId: string;
  public readonly accountId: string;
  public readonly paid: boolean;
  /** Versao lida do banco (trava otimista, RF-31); `null` enquanto nao foi persistido. */
  public readonly updatedAt: Date | null;

  private constructor(props: FixedExpensePersistenceProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.dueDay = props.dueDay;
    this.referenceMonth = props.referenceMonth ?? null;
    this.description = props.description ?? null;
    this.expectedAmount = props.expectedAmount;
    this.categoryId = props.categoryId;
    this.accountId = props.accountId;
    this.paid = props.paid;
    this.updatedAt = props.updatedAt ?? null;
  }

  /** Cria um gasto fixo novo: nasce sempre nao pago. */
  public static create(props: CreateFixedExpenseProps): FixedExpense {
    return FixedExpense.build({ ...props, paid: false });
  }

  /**
   * Reconstroi um gasto fixo ja persistido (adaptadores de `database/`), reaplicando as
   * mesmas invariantes de `create` por defesa em profundidade (CA-19, CA-20).
   */
  public static fromPersistence(props: FixedExpensePersistenceProps): FixedExpense {
    return FixedExpense.build(props);
  }

  /** Devolve o mesmo gasto fixo com outro `updatedAt` - usado pelos adaptadores ao (re)carimbar. */
  public withUpdatedAt(updatedAt: Date | null): FixedExpense {
    return new FixedExpense({ ...this.props(), updatedAt });
  }

  /** Marca como pago. Idempotente se ja estava pago. */
  public markAsPaid(): FixedExpense {
    return this.paid ? this : new FixedExpense({ ...this.props(), paid: true });
  }

  /** Marca como nao pago (ex.: virou o mes, reabre a cobranca). Idempotente. */
  public markAsUnpaid(): FixedExpense {
    return this.paid ? new FixedExpense({ ...this.props(), paid: false }) : this;
  }

  private static build(props: FixedExpensePersistenceProps): FixedExpense {
    const id = props.id.trim();
    const userId = props.userId.trim();
    const categoryId = props.categoryId.trim();
    const accountId = props.accountId.trim();

    if (id === '') throw new InvalidFixedExpenseError('id obrigatorio');
    if (userId === '') throw new InvalidFixedExpenseError('userId obrigatorio');
    if (!Number.isInteger(props.dueDay) || props.dueDay < 1 || props.dueDay > 31) {
      throw new InvalidFixedExpenseError('dueDay deve ser inteiro entre 1 e 31');
    }
    if (props.referenceMonth !== undefined && props.referenceMonth !== null) {
      if (
        !Number.isInteger(props.referenceMonth) ||
        props.referenceMonth < 1 ||
        props.referenceMonth > 12
      ) {
        throw new InvalidFixedExpenseError('referenceMonth deve ser um mes entre 1 e 12');
      }
    }
    if (!(props.expectedAmount instanceof Money)) {
      throw new InvalidFixedExpenseError('expectedAmount deve ser Money');
    }
    if (props.expectedAmount.isNegative() || props.expectedAmount.isZero()) {
      throw new InvalidFixedExpenseError('expectedAmount deve ser positivo');
    }
    if (categoryId === '') throw new InvalidFixedExpenseError('categoryId obrigatorio');
    if (accountId === '') throw new InvalidFixedExpenseError('accountId obrigatorio');
    if (!isValidOptionalDate(props.updatedAt)) {
      throw new InvalidFixedExpenseError('updatedAt deve ser null ou uma data valida');
    }
    const description = props.description?.trim();

    return new FixedExpense({
      id,
      userId,
      dueDay: props.dueDay,
      referenceMonth: props.referenceMonth ?? null,
      description: description ? description : null,
      expectedAmount: props.expectedAmount,
      categoryId,
      accountId,
      paid: props.paid,
      updatedAt: props.updatedAt ?? null,
    });
  }

  private props(): FixedExpensePersistenceProps {
    return {
      id: this.id,
      userId: this.userId,
      dueDay: this.dueDay,
      referenceMonth: this.referenceMonth,
      description: this.description,
      expectedAmount: this.expectedAmount,
      categoryId: this.categoryId,
      accountId: this.accountId,
      paid: this.paid,
      updatedAt: this.updatedAt,
    };
  }
}
