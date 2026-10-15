import { Money } from '../shared/money.value.object.ts';
import { Recurrence } from '../shared/recurrence.value.object.ts';
import { isWithinMaxReach } from '../shared/recurrence.reach.ts';
import { isValidOptionalDate } from '../shared/is.valid.optional.date.ts';
import { InvalidSpendingLimitPlanError } from './invalid.spending.limit.plan.error.ts';

/** Dados necessarios para criar um plano de limite de gasto. */
export interface CreateSpendingLimitPlanProps {
  readonly id: string;
  readonly userId: string;
  /** Id da categoria do usuario (spec 003, RF-10). O nome vive no agregado `Category`. */
  readonly categoryId: string;
  readonly maxAmount: Money;
  readonly recurrence: Recurrence;
  /**
   * Ancora para o teto de alcance da recorrencia (`isWithinMaxReach`, spec 003, RF-18) -
   * papel equivalente a `Income.date`, so que aqui nao existe uma data de referencia do
   * usuario, entao e o momento da criacao do plano. Congelada: nunca muda em `withUpdatedAt`,
   * para a mesma `endDate` continuar valida em toda releitura futura (`fromPersistence`), nao
   * so no instante da criacao.
   */
  readonly createdAt: Date;
}

/** Dados de um plano ja persistido: iguais aos de criacao + a versao da trava otimista. */
export interface SpendingLimitPlanPersistenceProps extends CreateSpendingLimitPlanProps {
  /** Versao para trava otimista (spec 002, RF-31). `null`/ausente = nunca persistido. */
  readonly updatedAt?: Date | null;
}

/**
 * Definicao recorrente de um limite de gasto (categoria + valor maximo + recorrencia), sem
 * mes fixo - equivalente a `Income` para `SpendingLimit` (spec 016).
 *
 * Imutavel. So guarda a definicao: cada mes concreto nasce como um `SpendingLimit` separado
 * (vinculado por `SpendingLimit.definitionId`) quando o usuario "aplica" aquele mes
 * (`ApplySpendingLimitMonthUseCase`) - este agregado nao sabe de `SpendingLimit`.
 */
export class SpendingLimitPlan {
  public readonly id: string;
  public readonly userId: string;
  public readonly categoryId: string;
  public readonly maxAmount: Money;
  public readonly recurrence: Recurrence;
  public readonly createdAt: Date;
  /** Versao lida do banco (trava otimista, RF-31); `null` enquanto nao foi persistido. */
  public readonly updatedAt: Date | null;

  private constructor(props: SpendingLimitPlanPersistenceProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.categoryId = props.categoryId;
    this.maxAmount = props.maxAmount;
    this.recurrence = props.recurrence;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt ?? null;
  }

  public static create(props: CreateSpendingLimitPlanProps): SpendingLimitPlan {
    return SpendingLimitPlan.build(props);
  }

  /** Reconstroi um plano ja persistido, reaplicando as mesmas invariantes de `create`. */
  public static fromPersistence(props: SpendingLimitPlanPersistenceProps): SpendingLimitPlan {
    return SpendingLimitPlan.build(props);
  }

  /** Devolve o mesmo plano com outro `updatedAt` - usado pelos adaptadores ao (re)carimbar. */
  public withUpdatedAt(updatedAt: Date | null): SpendingLimitPlan {
    return SpendingLimitPlan.build({ ...this.props(), updatedAt });
  }

  private static build(props: SpendingLimitPlanPersistenceProps): SpendingLimitPlan {
    const id = props.id.trim();
    const userId = props.userId.trim();
    const categoryId = props.categoryId.trim();

    if (id === '') throw new InvalidSpendingLimitPlanError('id obrigatorio');
    if (userId === '') throw new InvalidSpendingLimitPlanError('userId obrigatorio');
    if (categoryId === '') throw new InvalidSpendingLimitPlanError('categoryId obrigatorio');
    if (!(props.maxAmount instanceof Money)) {
      throw new InvalidSpendingLimitPlanError('maxAmount deve ser Money');
    }
    if (props.maxAmount.isNegative() || props.maxAmount.isZero()) {
      throw new InvalidSpendingLimitPlanError('maxAmount deve ser positivo');
    }
    if (!(props.recurrence instanceof Recurrence)) {
      throw new InvalidSpendingLimitPlanError('recurrence deve ser Recurrence');
    }
    if (!(props.createdAt instanceof Date) || Number.isNaN(props.createdAt.getTime())) {
      throw new InvalidSpendingLimitPlanError('createdAt deve ser uma data valida');
    }
    if (
      props.recurrence.repeats() &&
      props.recurrence.endDate !== null &&
      !isWithinMaxReach(props.recurrence.frequency, props.createdAt, props.recurrence.endDate)
    ) {
      throw new InvalidSpendingLimitPlanError('data final da recorrencia fora do alcance da frequencia');
    }
    if (!isValidOptionalDate(props.updatedAt)) {
      throw new InvalidSpendingLimitPlanError('updatedAt deve ser null ou uma data valida');
    }

    return new SpendingLimitPlan({
      id,
      userId,
      categoryId,
      maxAmount: props.maxAmount,
      recurrence: props.recurrence,
      createdAt: props.createdAt,
      updatedAt: props.updatedAt ?? null,
    });
  }

  private props(): SpendingLimitPlanPersistenceProps {
    return {
      id: this.id,
      userId: this.userId,
      categoryId: this.categoryId,
      maxAmount: this.maxAmount,
      recurrence: this.recurrence,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
