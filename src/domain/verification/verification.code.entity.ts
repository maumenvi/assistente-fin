import { VERIFICATION_CHANNELS, type VerificationChannel } from './verification.channel.ts';
import { InvalidVerificationCodeError } from './invalid.verification.code.error.ts';
import { VerificationCodeExpiredError } from './verification.code.expired.error.ts';
import { VerificationCodeAlreadyConfirmedError } from './verification.code.already.confirmed.error.ts';

/** Formato do codigo: 6 digitos numericos (spec 001, RF-24). */
const CODE_PATTERN = /^\d{6}$/;

/**
 * Dados necessarios para gerar um codigo de verificacao. `code` vem do
 * `VerificationCodeGenerator` injetado, `expiresAt`/`createdAt` do `Clock` - a entidade
 * continua pura (rule 8), sem gerar nada sozinha.
 */
export interface CreateVerificationCodeProps {
  readonly id: string;
  readonly userId: string;
  readonly channel: VerificationChannel;
  readonly code: string;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

/** Dados de um codigo ja persistido, incluindo se ja foi confirmado. */
export interface VerificationCodePersistenceProps extends CreateVerificationCodeProps {
  readonly confirmedAt: Date | null;
}

/**
 * Codigo de verificacao de e-mail/telefone (spec 001, RF-24..RF-27).
 *
 * Imutavel. Uma tabela propria (nao embutida em `User`) guarda o historico: cada solicitacao
 * (`RequestVerification`) gera um registro novo; `confirm()` e a unica forma de marcar um
 * confirmado, e reforca as invariantes de negocio (nao confirmar duas vezes, nao confirmar
 * expirado).
 */
export class VerificationCode {
  public readonly id: string;
  public readonly userId: string;
  public readonly channel: VerificationChannel;
  public readonly code: string;
  public readonly expiresAt: Date;
  public readonly createdAt: Date;
  public readonly confirmedAt: Date | null;

  private constructor(props: VerificationCodePersistenceProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.channel = props.channel;
    this.code = props.code;
    this.expiresAt = props.expiresAt;
    this.createdAt = props.createdAt;
    this.confirmedAt = props.confirmedAt;
  }

  /** Cria um codigo novo: nasce sempre nao confirmado. */
  public static create(props: CreateVerificationCodeProps): VerificationCode {
    return VerificationCode.build({ ...props, confirmedAt: null });
  }

  /**
   * Reconstroi um codigo ja persistido (adaptadores de `database/`), reaplicando as mesmas
   * invariantes de `create` por defesa em profundidade (CA-19, CA-20).
   */
  public static fromPersistence(props: VerificationCodePersistenceProps): VerificationCode {
    return VerificationCode.build(props);
  }

  /**
   * Confirma o codigo agora (spec 001, RF-26, RF-27, CA-22, CA-23). Comparar o codigo
   * digitado pelo usuario com `this.code` e responsabilidade do caso de uso - aqui so as
   * invariantes de tempo/estado.
   */
  public confirm(now: Date): VerificationCode {
    if (this.confirmedAt) {
      throw new VerificationCodeAlreadyConfirmedError();
    }
    if (this.isExpired(now)) {
      throw new VerificationCodeExpiredError();
    }
    return new VerificationCode({ ...this.props(), confirmedAt: now });
  }

  /** `true` quando `now` ja passou de `expiresAt`. */
  public isExpired(now: Date): boolean {
    return now.getTime() > this.expiresAt.getTime();
  }

  private static build(props: VerificationCodePersistenceProps): VerificationCode {
    const id = props.id.trim();
    const userId = props.userId.trim();

    if (id === '') throw new InvalidVerificationCodeError('id obrigatorio');
    if (userId === '') throw new InvalidVerificationCodeError('userId obrigatorio');
    if (!VERIFICATION_CHANNELS.includes(props.channel)) {
      throw new InvalidVerificationCodeError(`canal desconhecido: ${String(props.channel)}`);
    }
    if (!CODE_PATTERN.test(props.code)) {
      throw new InvalidVerificationCodeError('codigo deve ter 6 digitos numericos');
    }
    if (!(props.expiresAt instanceof Date) || Number.isNaN(props.expiresAt.getTime())) {
      throw new InvalidVerificationCodeError('expiresAt deve ser uma data valida');
    }
    if (!(props.createdAt instanceof Date) || Number.isNaN(props.createdAt.getTime())) {
      throw new InvalidVerificationCodeError('createdAt deve ser uma data valida');
    }
    if (props.expiresAt.getTime() <= props.createdAt.getTime()) {
      throw new InvalidVerificationCodeError('expiresAt deve ser depois de createdAt');
    }
    if (
      props.confirmedAt !== null &&
      (!(props.confirmedAt instanceof Date) || Number.isNaN(props.confirmedAt.getTime()))
    ) {
      throw new InvalidVerificationCodeError('confirmedAt deve ser null ou uma data valida');
    }

    return new VerificationCode({
      id,
      userId,
      channel: props.channel,
      code: props.code,
      expiresAt: props.expiresAt,
      createdAt: props.createdAt,
      confirmedAt: props.confirmedAt,
    });
  }

  private props(): VerificationCodePersistenceProps {
    return {
      id: this.id,
      userId: this.userId,
      channel: this.channel,
      code: this.code,
      expiresAt: this.expiresAt,
      createdAt: this.createdAt,
      confirmedAt: this.confirmedAt,
    };
  }
}
