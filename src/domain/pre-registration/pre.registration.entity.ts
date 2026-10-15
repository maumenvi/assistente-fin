import { Money } from '../shared/money.value.object.ts';
import { isValidOptionalDate } from '../shared/is.valid.optional.date.ts';
import { PAYMENT_METHODS, type PaymentMethod } from '../simulation/payment.method.ts';
import { PRE_REGISTRATION_ORIGINS, type PreRegistrationOrigin } from './pre.registration.origin.ts';
import { type PreRegistrationField } from './pre.registration.field.ts';
import { InvalidPreRegistrationError } from './invalid.pre.registration.error.ts';

const MAX_DESCRIPTION = 200;
const MAX_INSTALLMENTS = 48;

/** Campos editaveis de um pre-registro: todos opcionais (FR-022, FR-023). */
export interface PreRegistrationEditableProps {
  readonly amount?: Money | null | undefined;
  readonly description?: string | null | undefined;
  readonly date?: Date | null | undefined;
  /** Conta ou cartao (conta do tipo `credit-card`). */
  readonly accountId?: string | null | undefined;
  readonly paymentMethod?: PaymentMethod | null | undefined;
  readonly installments?: number | null | undefined;
  readonly categoryId?: string | null | undefined;
  readonly notes?: string | null | undefined;
  readonly needsReview?: boolean | undefined;
  readonly manualOnly?: boolean | undefined;
  readonly possibleDuplicateOf?: string | null | undefined;
  /** O usuario respondeu "sao compras diferentes": nunca mais agrupado nem remarcado como duplicata (spec 028). */
  readonly duplicateReviewed?: boolean | undefined;
}

/** Dados para criar um pre-registro. */
export interface CreatePreRegistrationProps extends PreRegistrationEditableProps {
  readonly id: string;
  readonly userId: string;
  readonly origin: PreRegistrationOrigin;
  readonly createdAt: Date;
  /** Chave de deduplicacao da captura (chave da NFC-e, hash da notificacao). Nao e unica. */
  readonly dedupKey?: string | null | undefined;
  /** Nome do celular que criou (modo conjunto). */
  readonly sourceDevice?: string | null | undefined;
}

/** Dados de um pre-registro ja persistido. */
export interface PreRegistrationPersistenceProps extends CreatePreRegistrationProps {
  readonly updatedAt?: Date | null;
}

/**
 * Pre-registro de compra (spec 022, FR-021..FR-027): uma compra anotada que ainda NAO e
 * lancamento - nao entra em saldo, extrato, fatura, limites nem previsao. Aceita dados
 * incompletos; `missingForApproval` diz o que falta para virar lancamento. Deixa de existir
 * ao ser aprovado (vira `Transaction`) ou descartado.
 */
export class PreRegistration {
  public readonly id: string;
  public readonly userId: string;
  public readonly origin: PreRegistrationOrigin;
  public readonly amount: Money | null;
  public readonly description: string | null;
  public readonly date: Date | null;
  public readonly accountId: string | null;
  public readonly paymentMethod: PaymentMethod | null;
  public readonly installments: number | null;
  public readonly categoryId: string | null;
  public readonly notes: string | null;
  public readonly needsReview: boolean;
  public readonly manualOnly: boolean;
  public readonly dedupKey: string | null;
  public readonly possibleDuplicateOf: string | null;
  public readonly duplicateReviewed: boolean;
  public readonly sourceDevice: string | null;
  public readonly createdAt: Date;
  public readonly updatedAt: Date | null;

  private constructor(props: PreRegistrationPersistenceProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.origin = props.origin;
    this.amount = props.amount ?? null;
    this.description = props.description ?? null;
    this.date = props.date ?? null;
    this.accountId = props.accountId ?? null;
    this.paymentMethod = props.paymentMethod ?? null;
    this.installments = props.installments ?? null;
    this.categoryId = props.categoryId ?? null;
    this.notes = props.notes ?? null;
    this.needsReview = props.needsReview ?? false;
    this.manualOnly = props.manualOnly ?? false;
    this.dedupKey = props.dedupKey ?? null;
    this.possibleDuplicateOf = props.possibleDuplicateOf ?? null;
    this.duplicateReviewed = props.duplicateReviewed ?? false;
    this.sourceDevice = props.sourceDevice ?? null;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt ?? null;
  }

  /** Cria um pre-registro novo. */
  public static create(props: CreatePreRegistrationProps): PreRegistration {
    return PreRegistration.build({ ...props, updatedAt: null });
  }

  /** Reconstroi um pre-registro persistido, reaplicando as invariantes. */
  public static fromPersistence(props: PreRegistrationPersistenceProps): PreRegistration {
    return PreRegistration.build(props);
  }

  /** Aplica uma edicao (qualquer campo editavel, FR-023). Origem, dono e criacao nao mudam. */
  public update(patch: PreRegistrationEditableProps): PreRegistration {
    return PreRegistration.build({ ...this.props(), ...patch });
  }

  /** Mesmo pre-registro com outro `updatedAt` (trava otimista). */
  public withUpdatedAt(updatedAt: Date | null): PreRegistration {
    return new PreRegistration({ ...this.props(), updatedAt });
  }

  /** Campos obrigatorios de um lancamento ainda vazios (FR-024). Categoria e opcional. */
  public missingForApproval(): PreRegistrationField[] {
    const missing: PreRegistrationField[] = [];
    if (this.amount === null) missing.push('amount');
    if (this.date === null) missing.push('date');
    if (this.accountId === null) missing.push('accountId');
    if (this.paymentMethod === null) missing.push('paymentMethod');
    return missing;
  }

  private static build(props: PreRegistrationPersistenceProps): PreRegistration {
    const id = props.id.trim();
    const userId = props.userId.trim();
    if (id === '') throw new InvalidPreRegistrationError('id obrigatorio');
    if (userId === '') throw new InvalidPreRegistrationError('userId obrigatorio');
    if (!PRE_REGISTRATION_ORIGINS.includes(props.origin)) {
      throw new InvalidPreRegistrationError(`origem desconhecida: ${String(props.origin)}`);
    }
    const amount = props.amount ?? null;
    if (amount !== null && (!(amount instanceof Money) || amount.isNegative() || amount.isZero())) {
      throw new InvalidPreRegistrationError('valor deve ser positivo');
    }
    const description = emptyToNull(props.description);
    if (description !== null && description.length > MAX_DESCRIPTION) {
      throw new InvalidPreRegistrationError(`descricao com mais de ${MAX_DESCRIPTION} caracteres`);
    }
    const paymentMethod = props.paymentMethod ?? null;
    if (paymentMethod !== null && !PAYMENT_METHODS.includes(paymentMethod)) {
      throw new InvalidPreRegistrationError(`forma de pagamento desconhecida: ${String(paymentMethod)}`);
    }
    const installments = props.installments ?? null;
    if (installments !== null) {
      if (!Number.isInteger(installments) || installments < 1 || installments > MAX_INSTALLMENTS) {
        throw new InvalidPreRegistrationError(`parcelas devem ser inteiro entre 1 e ${MAX_INSTALLMENTS}`);
      }
      if (installments > 1 && paymentMethod !== 'credit-card') {
        throw new InvalidPreRegistrationError('parcelamento so no cartao de credito');
      }
    }
    const date = props.date ?? null;
    if (!isValidOptionalDate(date)) throw new InvalidPreRegistrationError('data invalida');
    if (!isValidOptionalDate(props.createdAt)) throw new InvalidPreRegistrationError('createdAt invalido');
    if (!isValidOptionalDate(props.updatedAt)) throw new InvalidPreRegistrationError('updatedAt invalido');

    return new PreRegistration({
      id,
      userId,
      origin: props.origin,
      amount,
      description,
      date,
      accountId: emptyToNull(props.accountId),
      paymentMethod,
      installments,
      categoryId: emptyToNull(props.categoryId),
      notes: emptyToNull(props.notes),
      needsReview: props.needsReview ?? false,
      manualOnly: props.manualOnly ?? false,
      dedupKey: emptyToNull(props.dedupKey),
      // revisado = respondido "diferentes": nao ha mais a que apontar (spec 028, data-model)
      possibleDuplicateOf: props.duplicateReviewed === true ? null : emptyToNull(props.possibleDuplicateOf),
      duplicateReviewed: props.duplicateReviewed ?? false,
      sourceDevice: emptyToNull(props.sourceDevice),
      createdAt: props.createdAt,
      updatedAt: props.updatedAt ?? null,
    });
  }

  private props(): PreRegistrationPersistenceProps {
    return {
      id: this.id,
      userId: this.userId,
      origin: this.origin,
      amount: this.amount,
      description: this.description,
      date: this.date,
      accountId: this.accountId,
      paymentMethod: this.paymentMethod,
      installments: this.installments,
      categoryId: this.categoryId,
      notes: this.notes,
      needsReview: this.needsReview,
      manualOnly: this.manualOnly,
      dedupKey: this.dedupKey,
      possibleDuplicateOf: this.possibleDuplicateOf,
      duplicateReviewed: this.duplicateReviewed,
      sourceDevice: this.sourceDevice,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}
