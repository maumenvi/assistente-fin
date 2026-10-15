import { Cpf } from '../shared/cpf.value.object.ts';
import { Email } from '../shared/email.value.object.ts';
import { Phone } from '../shared/phone.value.object.ts';
import { isValidOptionalDate } from '../shared/is.valid.optional.date.ts';
import { InvalidUserError } from './invalid.user.error.ts';

/** Comprimento maximo do nome de um usuario. */
const MAX_NAME_LENGTH = 120;

/**
 * Dados necessarios para criar um usuario. `createdAt` vem de fora (rule 8: entidade pura,
 * sem `new Date()` escondido) - quem gera e o caso de uso, do mesmo jeito que `id` vem do
 * `IdGenerator`. E-mail e telefone sao obrigatorios (RF-23); todo usuario novo nasce com os
 * dois nao verificados (RF-26) - so `fromPersistence` aceita um estado ja verificado.
 */
export interface CreateUserProps {
  readonly id: string;
  readonly cpf: Cpf;
  readonly email: Email;
  readonly phone: Phone;
  readonly name: string;
  readonly createdAt: Date;
}

/**
 * Dados de um usuario ja persistido, incluindo o status de verificacao (RF-26, RF-28) e a
 * credencial opcional da borda desktop (spec 002, RF-9): `passwordHash` e `recoveryKeyHash`
 * andam juntos (senha => sempre ha chave de recuperacao); `null`/ausente = usuario sem senha.
 */
export interface UserPersistenceProps extends CreateUserProps {
  readonly emailVerifiedAt: Date | null;
  readonly phoneVerifiedAt: Date | null;
  readonly passwordHash?: string | null;
  readonly recoveryKeyHash?: string | null;
  /**
   * `chat_id` do Telegram vinculado (spec 002, Fase 8.5-T4) - alvo do envio do "telefone"
   * quando o canal e o Telegram. `null`/ausente = nao vinculado.
   */
  readonly telegramChatId?: string | null;
  /**
   * Conta padrao para pre-selecao no cadastro de lancamentos (spec 007, RF-3, RF-5).
   * `null`/ausente = sem preferencia definida.
   */
  readonly defaultAccountId?: string | null;
  /**
   * Limite de saldo baixo do Dashboard, em centavos (spec 015, RF-2). `null`/ausente = usuario
   * nunca configurou, resolve para o padrao do sistema (R$ 400,00) na borda de leitura.
   */
  readonly lowBalanceThresholdCents?: number | null;
  /** Versao para trava otimista (spec 002, RF-31). `null`/ausente = nunca persistido. */
  readonly updatedAt?: Date | null;
}

/**
 * Usuario vinculado a CPF, e-mail e telefone (spec 001, RF-15, RF-16, RF-23).
 *
 * Imutavel. O CPF identifica o usuario no sistema multiusuario; unicidade de CPF/e-mail/
 * telefone e responsabilidade do caso de uso + repositorio (CA-13), nao da entidade.
 * `isVerified()` (RF-28) e o que `CreateAccount` e outras acoes futuras checam antes de
 * deixar o usuario agir - a partir de 2026-09-08 basta UM canal verificado (decisao do
 * usuario); `hasAllChannelsVerified()` diz se ainda falta algum (dirige o nudge da UI).
 */
export class User {
  public readonly id: string;
  public readonly cpf: Cpf;
  public readonly email: Email;
  public readonly phone: Phone;
  public readonly name: string;
  public readonly createdAt: Date;
  public readonly emailVerifiedAt: Date | null;
  public readonly phoneVerifiedAt: Date | null;
  public readonly passwordHash: string | null;
  public readonly recoveryKeyHash: string | null;
  /** `chat_id` do Telegram vinculado (spec 002, Fase 8.5-T4); `null` = nao vinculado. */
  public readonly telegramChatId: string | null;
  /** Conta padrao para novos lancamentos (spec 007, RF-3); `null` = sem preferencia. */
  public readonly defaultAccountId: string | null;
  /**
   * Limite de saldo baixo do Dashboard em centavos (spec 015, RF-2); `null` = usuario nunca
   * configurou (resolve para o padrao do sistema na borda de leitura, nao aqui).
   */
  public readonly lowBalanceThresholdCents: number | null;
  /** Versao lida do banco (trava otimista, RF-31); `null` enquanto nao foi persistido. */
  public readonly updatedAt: Date | null;

  private constructor(props: UserPersistenceProps) {
    this.id = props.id;
    this.cpf = props.cpf;
    this.email = props.email;
    this.phone = props.phone;
    this.name = props.name;
    this.createdAt = props.createdAt;
    this.emailVerifiedAt = props.emailVerifiedAt;
    this.phoneVerifiedAt = props.phoneVerifiedAt;
    this.passwordHash = props.passwordHash ?? null;
    this.recoveryKeyHash = props.recoveryKeyHash ?? null;
    this.telegramChatId = props.telegramChatId ?? null;
    this.defaultAccountId = props.defaultAccountId ?? null;
    this.lowBalanceThresholdCents = props.lowBalanceThresholdCents ?? null;
    this.updatedAt = props.updatedAt ?? null;
  }

  /**
   * Cria um usuario novo: nasce sempre com e-mail e telefone nao verificados (RF-26) e sem
   * senha nem chave de recuperacao (spec 002, RF-9 - a senha e opcional, definida depois).
   */
  public static create(props: CreateUserProps): User {
    return User.build({
      ...props,
      emailVerifiedAt: null,
      phoneVerifiedAt: null,
      passwordHash: null,
      recoveryKeyHash: null,
      telegramChatId: null,
      defaultAccountId: null,
      lowBalanceThresholdCents: null,
    });
  }

  /**
   * Reconstroi um usuario ja persistido (adaptadores de `database/`), reaplicando as
   * mesmas invariantes de `create` por defesa em profundidade (CA-19, CA-20).
   */
  public static fromPersistence(props: UserPersistenceProps): User {
    return User.build(props);
  }

  /** Marca o e-mail como verificado agora. Idempotente se ja estava verificado. */
  public verifyEmail(now: Date): User {
    return this.emailVerifiedAt ? this : new User({ ...this.props(), emailVerifiedAt: now });
  }

  /** Marca o telefone como verificado agora. Idempotente se ja estava verificado. */
  public verifyPhone(now: Date): User {
    return this.phoneVerifiedAt ? this : new User({ ...this.props(), phoneVerifiedAt: now });
  }

  /**
   * Vincula o `chat_id` do Telegram e ja marca o telefone como verificado (spec 002,
   * Fase 8.5-T4): o proprio ato de abrir o bot e enviar `/start <token>` prova a posse.
   * Atualiza o `chat_id` se mudar; preserva a data da 1a verificacao.
   */
  public linkTelegram(chatId: string, now: Date): User {
    const trimmed = chatId.trim();
    if (trimmed === '') {
      throw new InvalidUserError('chatId do Telegram obrigatorio');
    }
    return new User({
      ...this.props(),
      telegramChatId: trimmed,
      phoneVerifiedAt: this.phoneVerifiedAt ?? now,
    });
  }

  /**
   * Pelo menos um canal de contato verificado (RF-28) - condicao pra `CreateAccount` e as
   * demais acoes que criam dado financeiro. Antes exigia os dois; desde 2026-09-08 um basta
   * (decisao do usuario) - quem instala o app e cria o 1o usuario ja nasce verificado.
   */
  public isVerified(): boolean {
    return this.emailVerifiedAt !== null || this.phoneVerifiedAt !== null;
  }

  /** E-mail E telefone verificados - a UI usa pra decidir se ainda mostra o nudge. */
  public hasAllChannelsVerified(): boolean {
    return this.emailVerifiedAt !== null && this.phoneVerifiedAt !== null;
  }

  /** `true` quando o usuario tem senha de acesso definida (spec 002, RF-9). */
  public hasPassword(): boolean {
    return this.passwordHash !== null;
  }

  /** Devolve o mesmo usuario com outro `updatedAt` - usado pelos adaptadores ao (re)carimbar. */
  public withUpdatedAt(updatedAt: Date | null): User {
    return new User({ ...this.props(), updatedAt });
  }

  /** Define/troca o hash da senha (o caso de uso ja o derivou com `PasswordHasher`). */
  public setPassword(passwordHash: string): User {
    return new User({ ...this.props(), passwordHash });
  }

  /** Define/rotaciona o hash da chave de recuperacao (spec 002, RF-9c). */
  public setRecoveryKey(recoveryKeyHash: string): User {
    return new User({ ...this.props(), recoveryKeyHash });
  }

  /** Remove a senha e a chave de recuperacao (RF-9, RF-9e) - o acesso volta a ser sem senha. */
  public removePassword(): User {
    return new User({ ...this.props(), passwordHash: null, recoveryKeyHash: null });
  }

  /**
   * Define a conta padrao para novos lancamentos (spec 007, RF-3, RF-4). `null` limpa a
   * preferencia (volta ao comportamento sem conta padrao definida).
   */
  public setDefaultAccount(accountId: string | null): User {
    return new User({ ...this.props(), defaultAccountId: accountId });
  }

  /**
   * Define o limite de saldo baixo do Dashboard em centavos (spec 015, RF-2). `null` limpa a
   * preferencia (volta ao padrao do sistema, resolvido fora da entidade). Passa por `build()`
   * (nao pelo construtor direto) para reforcar a invariante "inteiro >= 0 ou null" por defesa
   * em profundidade.
   */
  public setLowBalanceThreshold(cents: number | null): User {
    return User.build({ ...this.props(), lowBalanceThresholdCents: cents });
  }

  private static build(props: UserPersistenceProps): User {
    const id = props.id.trim();
    const name = props.name.trim();

    if (id === '') throw new InvalidUserError('id obrigatorio');
    if (name === '') throw new InvalidUserError('nome obrigatorio');
    if (name.length > MAX_NAME_LENGTH) {
      throw new InvalidUserError(`nome acima de ${MAX_NAME_LENGTH} caracteres`);
    }
    if (!(props.cpf instanceof Cpf)) {
      throw new InvalidUserError('cpf deve ser Cpf');
    }
    if (!(props.email instanceof Email)) {
      throw new InvalidUserError('email deve ser Email');
    }
    if (!(props.phone instanceof Phone)) {
      throw new InvalidUserError('phone deve ser Phone');
    }
    if (!(props.createdAt instanceof Date) || Number.isNaN(props.createdAt.getTime())) {
      throw new InvalidUserError('createdAt deve ser uma data valida');
    }
    for (const [field, value] of [
      ['emailVerifiedAt', props.emailVerifiedAt],
      ['phoneVerifiedAt', props.phoneVerifiedAt],
    ] as const) {
      if (value !== null && (!(value instanceof Date) || Number.isNaN(value.getTime()))) {
        throw new InvalidUserError(`${field} deve ser null ou uma data valida`);
      }
    }
    for (const [field, value] of [
      ['passwordHash', props.passwordHash],
      ['recoveryKeyHash', props.recoveryKeyHash],
      ['telegramChatId', props.telegramChatId],
      ['defaultAccountId', props.defaultAccountId],
    ] as const) {
      if (value !== null && value !== undefined && (typeof value !== 'string' || value.trim() === '')) {
        throw new InvalidUserError(`${field} deve ser null ou uma string nao vazia`);
      }
    }
    if (!isValidOptionalDate(props.updatedAt)) {
      throw new InvalidUserError('updatedAt deve ser null ou uma data valida');
    }
    if (
      props.lowBalanceThresholdCents !== null &&
      props.lowBalanceThresholdCents !== undefined &&
      (!Number.isInteger(props.lowBalanceThresholdCents) || props.lowBalanceThresholdCents < 0)
    ) {
      throw new InvalidUserError('lowBalanceThresholdCents deve ser null ou um inteiro >= 0');
    }

    return new User({
      id,
      cpf: props.cpf,
      email: props.email,
      phone: props.phone,
      name,
      createdAt: props.createdAt,
      emailVerifiedAt: props.emailVerifiedAt,
      phoneVerifiedAt: props.phoneVerifiedAt,
      passwordHash: props.passwordHash ?? null,
      recoveryKeyHash: props.recoveryKeyHash ?? null,
      telegramChatId: props.telegramChatId ?? null,
      defaultAccountId: props.defaultAccountId ?? null,
      lowBalanceThresholdCents: props.lowBalanceThresholdCents ?? null,
      updatedAt: props.updatedAt ?? null,
    });
  }

  private props(): UserPersistenceProps {
    return {
      id: this.id,
      cpf: this.cpf,
      email: this.email,
      phone: this.phone,
      name: this.name,
      createdAt: this.createdAt,
      emailVerifiedAt: this.emailVerifiedAt,
      phoneVerifiedAt: this.phoneVerifiedAt,
      passwordHash: this.passwordHash,
      recoveryKeyHash: this.recoveryKeyHash,
      telegramChatId: this.telegramChatId,
      defaultAccountId: this.defaultAccountId,
      lowBalanceThresholdCents: this.lowBalanceThresholdCents,
      updatedAt: this.updatedAt,
    };
  }
}
