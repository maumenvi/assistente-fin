import { Money } from '../shared/money.value.object.ts';
import { Recurrence } from '../shared/recurrence.value.object.ts';
import { isWithinMaxReach } from '../shared/recurrence.reach.ts';
import { isValidOptionalDate } from '../shared/is.valid.optional.date.ts';
import { PAYMENT_METHODS, type PaymentMethod } from './payment.method.ts';
import { InvalidSimulationError } from './invalid.simulation.error.ts';
import { SimulationAlreadyApprovedError } from './simulation.already.approved.error.ts';

/** Dados necessarios para criar uma simulacao de compra. */
export interface CreateSimulationProps {
  readonly id: string;
  readonly userId: string;
  readonly amount: Money;
  readonly date: Date;
  /** Id da categoria do usuario (spec 003, RF-10). O nome vive no agregado `Category`. */
  readonly categoryId: string;
  readonly payment: PaymentMethod;
  readonly installments: number;
  readonly recurrence: Recurrence;
  readonly accountId: string;
}

/** Dados de uma simulacao ja persistida, incluindo se ja foi aprovada. */
export interface SimulationPersistenceProps extends CreateSimulationProps {
  readonly approvedAt: Date | null;
  /** Versao para trava otimista (spec 002, RF-31). `null`/ausente = nunca persistida. */
  readonly updatedAt?: Date | null;
}

/**
 * Simulacao de compra (spec 001, RF-9..RF-11).
 *
 * Imutavel. Nasce sempre nao aprovada; `approve(now)` e a unica forma de marcar aprovada
 * (idempotencia reforcada - CA-19/CA-20 mesmo padrao de `VerificationCode.confirm`).
 * `installments > 1` e `recurrence.kind !== 'none'` sao mutuamente exclusivos - CA-8/9/10
 * descrevem tres modos distintos (a vista / parcelada / recorrente), nao combinaveis nesta
 * entrega (plan.md, decisao 13).
 */
export class PurchaseSimulation {
  public readonly id: string;
  public readonly userId: string;
  public readonly amount: Money;
  public readonly date: Date;
  public readonly categoryId: string;
  public readonly payment: PaymentMethod;
  public readonly installments: number;
  public readonly recurrence: Recurrence;
  public readonly accountId: string;
  public readonly approvedAt: Date | null;
  /** Versao lida do banco (trava otimista, RF-31); `null` enquanto nao foi persistida. */
  public readonly updatedAt: Date | null;

  private constructor(props: SimulationPersistenceProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.amount = props.amount;
    this.date = props.date;
    this.categoryId = props.categoryId;
    this.payment = props.payment;
    this.installments = props.installments;
    this.recurrence = props.recurrence;
    this.accountId = props.accountId;
    this.approvedAt = props.approvedAt;
    this.updatedAt = props.updatedAt ?? null;
  }

  /** Cria uma simulacao nova: nasce sempre nao aprovada. */
  public static create(props: CreateSimulationProps): PurchaseSimulation {
    return PurchaseSimulation.build({ ...props, approvedAt: null });
  }

  /**
   * Reconstroi uma simulacao ja persistida (adaptadores de `database/`), reaplicando as
   * mesmas invariantes de `create` por defesa em profundidade (CA-19, CA-20).
   */
  public static fromPersistence(props: SimulationPersistenceProps): PurchaseSimulation {
    return PurchaseSimulation.build(props);
  }

  /** Devolve a mesma simulacao com outro `updatedAt` - usado pelos adaptadores ao (re)carimbar. */
  public withUpdatedAt(updatedAt: Date | null): PurchaseSimulation {
    return new PurchaseSimulation({ ...this.props(), updatedAt });
  }

  /** `true` quando a compra se repete - modo "recorrente" (CA-10). */
  public isRecurring(): boolean {
    return this.recurrence.repeats();
  }

  /** `true` quando a compra e parcelada (>1 parcela) - modo "parcelada" (CA-9). */
  public isInstallment(): boolean {
    return this.installments > 1;
  }

  /** Marca aprovada agora. Lanca `SimulationAlreadyApprovedError` se ja estava. */
  public approve(now: Date): PurchaseSimulation {
    if (this.approvedAt) {
      throw new SimulationAlreadyApprovedError();
    }
    return new PurchaseSimulation({ ...this.props(), approvedAt: now });
  }

  private static build(props: SimulationPersistenceProps): PurchaseSimulation {
    const id = props.id.trim();
    const userId = props.userId.trim();
    const categoryId = props.categoryId.trim();
    const accountId = props.accountId.trim();

    if (id === '') throw new InvalidSimulationError('id obrigatorio');
    if (userId === '') throw new InvalidSimulationError('userId obrigatorio');
    if (!(props.amount instanceof Money)) {
      throw new InvalidSimulationError('amount deve ser Money');
    }
    if (props.amount.isNegative() || props.amount.isZero()) {
      throw new InvalidSimulationError('amount deve ser positivo');
    }
    if (!(props.date instanceof Date) || Number.isNaN(props.date.getTime())) {
      throw new InvalidSimulationError('date deve ser uma data valida');
    }
    if (categoryId === '') throw new InvalidSimulationError('categoryId obrigatorio');
    if (!PAYMENT_METHODS.includes(props.payment)) {
      throw new InvalidSimulationError(`payment desconhecido: ${String(props.payment)}`);
    }
    if (!Number.isInteger(props.installments) || props.installments < 1) {
      throw new InvalidSimulationError('installments deve ser inteiro >= 1');
    }
    if (!(props.recurrence instanceof Recurrence)) {
      throw new InvalidSimulationError('recurrence deve ser Recurrence');
    }
    if (
      props.recurrence.repeats() &&
      props.recurrence.endDate !== null &&
      !isWithinMaxReach(props.recurrence.frequency, props.date, props.recurrence.endDate)
    ) {
      throw new InvalidSimulationError('data final da recorrencia fora do alcance da frequencia');
    }
    if (props.installments > 1 && props.recurrence.repeats()) {
      throw new InvalidSimulationError(
        'parcelada (installments > 1) e recorrente sao mutuamente exclusivas',
      );
    }
    if (accountId === '') throw new InvalidSimulationError('accountId obrigatorio');
    if (!isValidOptionalDate(props.approvedAt)) {
      throw new InvalidSimulationError('approvedAt deve ser null ou uma data valida');
    }
    if (!isValidOptionalDate(props.updatedAt)) {
      throw new InvalidSimulationError('updatedAt deve ser null ou uma data valida');
    }

    return new PurchaseSimulation({
      id,
      userId,
      amount: props.amount,
      date: props.date,
      categoryId,
      payment: props.payment,
      installments: props.installments,
      recurrence: props.recurrence,
      accountId,
      approvedAt: props.approvedAt,
      updatedAt: props.updatedAt ?? null,
    });
  }

  private props(): SimulationPersistenceProps {
    return {
      id: this.id,
      userId: this.userId,
      amount: this.amount,
      date: this.date,
      categoryId: this.categoryId,
      payment: this.payment,
      installments: this.installments,
      recurrence: this.recurrence,
      accountId: this.accountId,
      approvedAt: this.approvedAt,
      updatedAt: this.updatedAt,
    };
  }
}
