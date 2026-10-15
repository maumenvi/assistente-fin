import { Money } from '../shared/money.value.object.ts';
import { Recurrence } from '../shared/recurrence.value.object.ts';
import { TRANSACTION_TYPES, type TransactionType } from './transaction.type.ts';
import { extendByOneReach, isWithinMaxReach } from '../shared/recurrence.reach.ts';
import { isValidOptionalDate } from '../shared/is.valid.optional.date.ts';
import { InvalidTransactionSeriesError } from './invalid.transaction.series.error.ts';

/** Comprimento maximo de textos livres (notes). */
/** Limite das observacoes: cabe o link de consulta da NFC-e (spec 022, FR-033). */
const MAX_TEXT_LENGTH = 500;

/** Dados necessarios para criar uma serie de transacoes. */
export interface CreateTransactionSeriesProps {
  readonly id: string;
  readonly userId: string;
  readonly accountId: string;
  readonly type: TransactionType;
  readonly amount: Money;
  readonly categoryId: string;
  readonly notes?: string | undefined;
  /** Sempre `repeats()` - uma serie `nao-repete` seria uma serie de uma ocorrencia so. */
  readonly recurrence: Recurrence;
  /** Data da primeira ocorrencia; base do calculo de todas as outras (spec 003, RF-25). */
  readonly anchorDate: Date;
}

/** Dados de uma serie ja persistida: iguais aos de criacao + a versao da trava otimista. */
export interface TransactionSeriesPersistenceProps extends CreateTransactionSeriesProps {
  /** Versao para trava otimista (spec 002, RF-31). `null`/ausente = nunca persistida. */
  readonly updatedAt?: Date | null;
}

/**
 * Serie de transacoes recorrentes (spec 003, RF-25).
 *
 * Guarda o "molde" de um lancamento manual recorrente: os campos comuns a todas as
 * ocorrencias mais a recorrencia e a ancora. As ocorrencias em si sao `Transaction` reais,
 * materializadas no save e ligadas de volta pelo `seriesId` - a serie nao as contem.
 *
 * Imutavel. `extend()` (usado por "prolongar", RF-21) empurra a data final da recorrencia;
 * `withUpdatedAt` recarimba. A validacao de alcance usa `anchorDate` como referencia, igual
 * a `Income`/`PurchaseSimulation`.
 */
export class TransactionSeries {
  public readonly id: string;
  public readonly userId: string;
  public readonly accountId: string;
  public readonly type: TransactionType;
  public readonly amount: Money;
  public readonly categoryId: string;
  public readonly notes: string | undefined;
  public readonly recurrence: Recurrence;
  public readonly anchorDate: Date;
  /** Versao lida do banco (trava otimista, RF-31); `null` enquanto nao foi persistida. */
  public readonly updatedAt: Date | null;

  private constructor(props: TransactionSeriesPersistenceProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.accountId = props.accountId;
    this.type = props.type;
    this.amount = props.amount;
    this.categoryId = props.categoryId;
    this.notes = props.notes;
    this.recurrence = props.recurrence;
    this.anchorDate = props.anchorDate;
    this.updatedAt = props.updatedAt ?? null;
  }

  public static create(props: CreateTransactionSeriesProps): TransactionSeries {
    return TransactionSeries.build(props, { enforceReach: true });
  }

  /**
   * Reconstroi uma serie ja persistida. Reaplica as invariantes de forma (`create`), MENOS o
   * teto de alcance ancorado na data inicial: uma serie prolongada (`extend`) tem, de
   * proposito, `endDate` alem desse teto, e recusa-la aqui a deixaria impossivel de carregar.
   */
  public static fromPersistence(props: TransactionSeriesPersistenceProps): TransactionSeries {
    return TransactionSeries.build(props, { enforceReach: false });
  }

  /** Devolve a mesma serie com outro `updatedAt` - usado pelos adaptadores ao (re)carimbar. */
  public withUpdatedAt(updatedAt: Date | null): TransactionSeries {
    return new TransactionSeries({ ...this.props(), updatedAt });
  }

  /**
   * "Prolongar" a serie (spec 003, RF-21, CA-25b): empurra a data final em exatamente um
   * alcance maximo da frequencia, a partir da data final ATUAL (nao da ancora, nao de hoje).
   *
   * Ao contrario de `create`/`fromPersistence`, esta e a unica forma de a data final passar
   * do teto ancorado na data inicial - de proposito: a serie so cresce um alcance por vez, e
   * "prolongar" existe justamente para ir alem do teto inicial. Devolve a nova serie e a
   * data final antiga (o caso de uso materializa as ocorrencias entre as duas).
   */
  public extend(): { readonly series: TransactionSeries; readonly previousEndDate: Date } {
    // `repeats()` garante `endDate !== null`; o `??` so satisfaz o compilador.
    const previousEndDate = this.recurrence.endDate ?? this.anchorDate;
    const nextEndDate = extendByOneReach(this.recurrence.frequency, previousEndDate);
    // sem `build`: `extend` e um passo controlado (1 alcance), nao entrada externa a validar
    const series = new TransactionSeries({
      ...this.props(),
      recurrence: this.recurrence.withEndDate(nextEndDate),
    });
    return { series, previousEndDate };
  }

  /**
   * "Encerrar" a serie numa data (spec 003, RF-29, CA-21): traz a data final da recorrencia
   * para `endAt`. O caso de uso ja apaga as ocorrencias futuras; aqui so ajusta o molde para
   * a serie parar de gerar dali em diante.
   *
   * `endAt` tem que ser posterior a ancora (uma serie tem >= 1 ocorrencia) e nao pode passar
   * do teto atual - encerrar so encurta, nunca prolonga. Lanca `InvalidTransactionSeriesError`
   * fora disso.
   */
  public endAt(endAt: Date): TransactionSeries {
    if (!(endAt instanceof Date) || Number.isNaN(endAt.getTime())) {
      throw new InvalidTransactionSeriesError('data de encerramento invalida');
    }
    if (endAt.getTime() < this.anchorDate.getTime()) {
      throw new InvalidTransactionSeriesError('encerramento antes da primeira ocorrencia');
    }
    const currentEnd = this.recurrence.endDate?.getTime() ?? this.anchorDate.getTime();
    if (endAt.getTime() > currentEnd) {
      throw new InvalidTransactionSeriesError('encerrar so encurta a serie, nunca prolonga');
    }
    return new TransactionSeries({
      ...this.props(),
      recurrence: this.recurrence.withEndDate(endAt),
    });
  }

  private static build(
    props: TransactionSeriesPersistenceProps,
    options: { readonly enforceReach: boolean },
  ): TransactionSeries {
    const id = props.id.trim();
    const userId = props.userId.trim();
    const accountId = props.accountId.trim();
    const categoryId = props.categoryId.trim();
    const notes = props.notes?.trim();

    if (id === '') throw new InvalidTransactionSeriesError('id obrigatorio');
    if (userId === '') throw new InvalidTransactionSeriesError('userId obrigatorio');
    if (accountId === '') throw new InvalidTransactionSeriesError('accountId obrigatorio');
    if (!TRANSACTION_TYPES.includes(props.type)) {
      throw new InvalidTransactionSeriesError(`type desconhecido: ${String(props.type)}`);
    }
    if (!(props.amount instanceof Money)) {
      throw new InvalidTransactionSeriesError('amount deve ser Money');
    }
    if (props.amount.isNegative() || props.amount.isZero()) {
      throw new InvalidTransactionSeriesError('amount deve ser positivo');
    }
    if (categoryId === '') throw new InvalidTransactionSeriesError('categoryId obrigatorio');
    if (notes !== undefined && notes.length > MAX_TEXT_LENGTH) {
      throw new InvalidTransactionSeriesError(`notes acima de ${MAX_TEXT_LENGTH} caracteres`);
    }
    if (!(props.recurrence instanceof Recurrence)) {
      throw new InvalidTransactionSeriesError('recurrence deve ser Recurrence');
    }
    if (!props.recurrence.repeats()) {
      throw new InvalidTransactionSeriesError('serie exige recorrencia (frequencia != nao-repete)');
    }
    if (!(props.anchorDate instanceof Date) || Number.isNaN(props.anchorDate.getTime())) {
      throw new InvalidTransactionSeriesError('anchorDate deve ser uma data valida');
    }
    // teto de alcance so no cadastro; `fromPersistence`/`extend` podem passar dele de proposito
    if (
      options.enforceReach &&
      !isWithinMaxReach(
        props.recurrence.frequency,
        props.anchorDate,
        // `repeats()` ja garante `endDate !== null`; o `??` so convence o compilador
        props.recurrence.endDate ?? props.anchorDate,
      )
    ) {
      throw new InvalidTransactionSeriesError('data final da recorrencia fora do alcance da frequencia');
    }
    if (!isValidOptionalDate(props.updatedAt)) {
      throw new InvalidTransactionSeriesError('updatedAt deve ser null ou uma data valida');
    }

    return new TransactionSeries({
      id,
      userId,
      accountId,
      type: props.type,
      amount: props.amount,
      categoryId,
      notes: notes === '' ? undefined : notes,
      recurrence: props.recurrence,
      anchorDate: props.anchorDate,
      updatedAt: props.updatedAt ?? null,
    });
  }

  private props(): TransactionSeriesPersistenceProps {
    return {
      id: this.id,
      userId: this.userId,
      accountId: this.accountId,
      type: this.type,
      amount: this.amount,
      categoryId: this.categoryId,
      notes: this.notes,
      recurrence: this.recurrence,
      anchorDate: this.anchorDate,
      updatedAt: this.updatedAt,
    };
  }
}
