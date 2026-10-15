import { Money } from '../shared/money.value.object.ts';
import { Month } from '../shared/month.value.object.ts';
import { isValidOptionalDate } from '../shared/is.valid.optional.date.ts';
import { InvalidSpendingLimitError } from './invalid.spending.limit.error.ts';

/** Dados necessarios para criar um limite de gasto. */
export interface CreateSpendingLimitProps {
  readonly id: string;
  readonly userId: string;
  /** Id da categoria do usuario (spec 003, RF-10). O nome vive no agregado `Category`. */
  readonly categoryId: string;
  readonly period: Month;
  readonly maxAmount: Money;
  /**
   * Id do `SpendingLimitPlan` que gerou este limite ao "aplicar" este mes (spec 016). `null`
   * = limite criado manualmente direto num mes (caminho antigo, preservado). 1:N - varios
   * `SpendingLimit` (um por mes aplicado) podem apontar para o mesmo plano.
   */
  readonly definitionId?: string | null | undefined;
}

/** Dados de um limite ja persistido: iguais aos de criacao + a versao da trava otimista. */
export interface SpendingLimitPersistenceProps extends CreateSpendingLimitProps {
  /** Versao para trava otimista (spec 002, RF-31). `null`/ausente = nunca persistido. */
  readonly updatedAt?: Date | null;
}

/**
 * Limite de gasto nao fixo por categoria e periodo (spec 001, RF-4, CA-4).
 *
 * Imutavel. So guarda a definicao do limite (categoria, mes de competencia, valor maximo) -
 * o status (`ok | at-risk | exceeded`) e calculado por `limit.status.ts`, funcao pura que
 * recebe o quanto ja foi gasto (vem de `Transaction`, fora do escopo desta entidade).
 */
export class SpendingLimit {
  public readonly id: string;
  public readonly userId: string;
  public readonly categoryId: string;
  public readonly period: Month;
  public readonly maxAmount: Money;
  /** Id do `SpendingLimitPlan` de origem (spec 016); `null` = criado manualmente. */
  public readonly definitionId: string | null;
  /** Versao lida do banco (trava otimista, RF-31); `null` enquanto nao foi persistido. */
  public readonly updatedAt: Date | null;

  private constructor(props: SpendingLimitPersistenceProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.categoryId = props.categoryId;
    this.period = props.period;
    this.maxAmount = props.maxAmount;
    this.definitionId = props.definitionId ?? null;
    this.updatedAt = props.updatedAt ?? null;
  }

  public static create(props: CreateSpendingLimitProps): SpendingLimit {
    return SpendingLimit.build(props);
  }

  /** Reconstroi um limite ja persistido, reaplicando as mesmas invariantes de `create`. */
  public static fromPersistence(props: SpendingLimitPersistenceProps): SpendingLimit {
    return SpendingLimit.build(props);
  }

  /** Devolve o mesmo limite com outro `updatedAt` - usado pelos adaptadores ao (re)carimbar. */
  public withUpdatedAt(updatedAt: Date | null): SpendingLimit {
    return SpendingLimit.build({ ...this.props(), updatedAt });
  }

  private static build(props: SpendingLimitPersistenceProps): SpendingLimit {
    const id = props.id.trim();
    const userId = props.userId.trim();
    const categoryId = props.categoryId.trim();

    if (id === '') throw new InvalidSpendingLimitError('id obrigatorio');
    if (userId === '') throw new InvalidSpendingLimitError('userId obrigatorio');
    if (categoryId === '') throw new InvalidSpendingLimitError('categoryId obrigatorio');
    if (!(props.period instanceof Month)) {
      throw new InvalidSpendingLimitError('period deve ser Month');
    }
    if (!(props.maxAmount instanceof Money)) {
      throw new InvalidSpendingLimitError('maxAmount deve ser Money');
    }
    if (props.maxAmount.isNegative() || props.maxAmount.isZero()) {
      throw new InvalidSpendingLimitError('maxAmount deve ser positivo');
    }
    const definitionId = props.definitionId?.trim() ?? null;
    if (definitionId === '') {
      throw new InvalidSpendingLimitError('definitionId, se informado, nao pode ser vazio');
    }
    if (!isValidOptionalDate(props.updatedAt)) {
      throw new InvalidSpendingLimitError('updatedAt deve ser null ou uma data valida');
    }

    return new SpendingLimit({
      id,
      userId,
      categoryId,
      period: props.period,
      maxAmount: props.maxAmount,
      definitionId,
      updatedAt: props.updatedAt ?? null,
    });
  }

  private props(): SpendingLimitPersistenceProps {
    return {
      id: this.id,
      userId: this.userId,
      categoryId: this.categoryId,
      period: this.period,
      maxAmount: this.maxAmount,
      definitionId: this.definitionId,
      updatedAt: this.updatedAt,
    };
  }
}
