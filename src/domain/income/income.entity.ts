import { Money } from '../shared/money.value.object.ts';
import { Recurrence } from '../shared/recurrence.value.object.ts';
import { isWithinMaxReach } from '../shared/recurrence.reach.ts';
import { isValidOptionalDate } from '../shared/is.valid.optional.date.ts';
import { InvalidIncomeError } from './invalid.income.error.ts';

/** Comprimento maximo de textos livres (source, notes). */
const MAX_TEXT_LENGTH = 120;

/** Dados necessarios para criar um ganho. */
export interface CreateIncomeProps {
  readonly id: string;
  readonly userId: string;
  readonly date: Date;
  readonly amount: Money;
  readonly source: string;
  readonly recurrence: Recurrence;
  /** Id da categoria do usuario (spec 003, RF-10). O nome vive no agregado `Category`. */
  readonly categoryId: string;
  readonly notes?: string | undefined;
  /**
   * Conta vinculada (spec 012, RF-1). `null`/ausente = ganho sem conta (simulacao de
   * cenario, `ApplyScenarioUseCase` - RF-12, ou registro legado anterior a esta feature -
   * RF-13): nao sincroniza com `TransactionSeries`, nao aparece no Extrato/Dashboard (RF-4).
   * O dominio nao verifica que a conta existe (rule 10: `Income` nao enxerga `Account`) -
   * so valida formato (nao-vazia apos `trim()` quando presente).
   */
  readonly accountId?: string | null | undefined;
}

/** Dados de um ganho ja persistido: iguais aos de criacao + a versao da trava otimista. */
export interface IncomePersistenceProps extends CreateIncomeProps {
  /** Versao para trava otimista (spec 002, RF-31). `null`/ausente = nunca persistido. */
  readonly updatedAt?: Date | null;
}

/**
 * Ganho detalhado (spec 001, RF-2, CA-2).
 *
 * Imutavel. Nao ha transicao de estado (diferente de `Account`/`User`): `create` e
 * `fromPersistence` validam exatamente as mesmas invariantes, a segunda existindo por
 * simetria com as outras entidades e defesa em profundidade (CA-19, CA-20).
 */
export class Income {
  public readonly id: string;
  public readonly userId: string;
  public readonly date: Date;
  public readonly amount: Money;
  public readonly source: string;
  public readonly recurrence: Recurrence;
  public readonly categoryId: string;
  public readonly notes: string | undefined;
  /** Conta vinculada (spec 012, RF-1); `null` = ganho sem conta. */
  public readonly accountId: string | null;
  /** Versao lida do banco (trava otimista, RF-31); `null` enquanto nao foi persistido. */
  public readonly updatedAt: Date | null;

  private constructor(props: IncomePersistenceProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.date = props.date;
    this.amount = props.amount;
    this.source = props.source;
    this.recurrence = props.recurrence;
    this.categoryId = props.categoryId;
    this.notes = props.notes;
    this.accountId = props.accountId ?? null;
    this.updatedAt = props.updatedAt ?? null;
  }

  public static create(props: CreateIncomeProps): Income {
    return Income.build(props);
  }

  /** Reconstroi um ganho ja persistido, reaplicando as mesmas invariantes de `create`. */
  public static fromPersistence(props: IncomePersistenceProps): Income {
    return Income.build(props);
  }

  /** Devolve o mesmo ganho com outro `updatedAt` - usado pelos adaptadores ao (re)carimbar. */
  public withUpdatedAt(updatedAt: Date | null): Income {
    return Income.build({ ...this.props(), updatedAt });
  }

  private static build(props: IncomePersistenceProps): Income {
    const id = props.id.trim();
    const userId = props.userId.trim();
    const source = props.source.trim();
    const categoryId = props.categoryId.trim();
    const notes = props.notes?.trim();
    const accountId = props.accountId != null ? props.accountId.trim() : props.accountId;

    if (id === '') throw new InvalidIncomeError('id obrigatorio');
    if (userId === '') throw new InvalidIncomeError('userId obrigatorio');
    if (!(props.date instanceof Date) || Number.isNaN(props.date.getTime())) {
      throw new InvalidIncomeError('date deve ser uma data valida');
    }
    if (!(props.amount instanceof Money)) {
      throw new InvalidIncomeError('amount deve ser Money');
    }
    if (props.amount.isNegative() || props.amount.isZero()) {
      throw new InvalidIncomeError('amount deve ser positivo');
    }
    if (source === '') throw new InvalidIncomeError('source obrigatorio');
    if (source.length > MAX_TEXT_LENGTH) {
      throw new InvalidIncomeError(`source acima de ${MAX_TEXT_LENGTH} caracteres`);
    }
    if (!(props.recurrence instanceof Recurrence)) {
      throw new InvalidIncomeError('recurrence deve ser Recurrence');
    }
    if (
      props.recurrence.repeats() &&
      props.recurrence.endDate !== null &&
      !isWithinMaxReach(props.recurrence.frequency, props.date, props.recurrence.endDate)
    ) {
      throw new InvalidIncomeError('data final da recorrencia fora do alcance da frequencia');
    }
    if (categoryId === '') throw new InvalidIncomeError('categoryId obrigatorio');
    if (notes !== undefined && notes.length > MAX_TEXT_LENGTH) {
      throw new InvalidIncomeError(`notes acima de ${MAX_TEXT_LENGTH} caracteres`);
    }
    if (accountId === '') throw new InvalidIncomeError('accountId nao pode ser string vazia');
    if (!isValidOptionalDate(props.updatedAt)) {
      throw new InvalidIncomeError('updatedAt deve ser null ou uma data valida');
    }

    return new Income({
      id,
      userId,
      date: props.date,
      amount: props.amount,
      source,
      recurrence: props.recurrence,
      categoryId,
      notes: notes === '' ? undefined : notes,
      accountId: accountId ?? null,
      updatedAt: props.updatedAt ?? null,
    });
  }

  private props(): IncomePersistenceProps {
    return {
      id: this.id,
      userId: this.userId,
      date: this.date,
      amount: this.amount,
      source: this.source,
      recurrence: this.recurrence,
      categoryId: this.categoryId,
      notes: this.notes,
      accountId: this.accountId,
      updatedAt: this.updatedAt,
    };
  }
}
