import { isValidUserNotificationSource } from './is.valid.user.notification.source.ts';
import { InvalidUserNotificationError } from './invalid.user.notification.error.ts';

const MAX_MESSAGE = 500;
const MAX_TITLE = 100;

/** Dados para emitir uma notificacao nova. */
export interface CreateUserNotificationProps {
  readonly id: string;
  readonly userId: string;
  readonly source: string;
  readonly title?: string | null | undefined;
  readonly message: string;
  readonly now: Date;
  /** Acima do limite de exibicao da origem (RF-9a): nasce ja entregue, nunca vira toast. */
  readonly suppressed?: boolean | undefined;
}

/** Dados de uma notificacao ja persistida. */
export interface UserNotificationPersistenceProps {
  readonly id: string;
  readonly userId: string;
  readonly source: string;
  readonly title: string | null;
  readonly message: string;
  readonly createdAt: Date;
  readonly deliveredAt: Date | null;
  readonly readAt: Date | null;
}

/**
 * Notificacao do usuario (spec 013, RF-5..RF-7a): um aviso emitido por qualquer origem (tool MCP,
 * captura do celular, fontes futuras), guardado no historico. `deliveredAt` marca quando o toast
 * nativo foi reivindicado (exibido no maximo uma vez, RF-11a) - ou o proprio `createdAt` quando a
 * notificacao nasceu suprimida pelo limite (RF-9a). `readAt` marca quando o usuario leu. Imutavel:
 * as transicoes devolvem uma instancia nova.
 */
export class UserNotification {
  public readonly id: string;
  public readonly userId: string;
  public readonly source: string;
  public readonly title: string | null;
  public readonly message: string;
  public readonly createdAt: Date;
  public readonly deliveredAt: Date | null;
  public readonly readAt: Date | null;

  private constructor(props: UserNotificationPersistenceProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.source = props.source;
    this.title = props.title;
    this.message = props.message;
    this.createdAt = props.createdAt;
    this.deliveredAt = props.deliveredAt;
    this.readAt = props.readAt;
  }

  /** Emite uma notificacao nova: pendente de exibicao (ou ja entregue, se suprimida) e nao lida. */
  public static create(props: CreateUserNotificationProps): UserNotification {
    return UserNotification.build({
      id: props.id,
      userId: props.userId,
      source: props.source,
      title: props.title ?? null,
      message: props.message,
      createdAt: props.now,
      deliveredAt: props.suppressed ? props.now : null,
      readAt: null,
    });
  }

  /** Remonta uma notificacao persistida, revalidando as invariantes. */
  public static fromPersistence(props: UserNotificationPersistenceProps): UserNotification {
    return UserNotification.build(props);
  }

  /** `true` quando o usuario ja marcou como lida. */
  public get isRead(): boolean {
    return this.readAt !== null;
  }

  /** `true` enquanto o toast nativo ainda nao foi reivindicado. */
  public get isPendingDelivery(): boolean {
    return this.deliveredAt === null;
  }

  /** Marca como lida; idempotente (mantem o primeiro `readAt`). */
  public markRead(now: Date): UserNotification {
    return this.isRead ? this : new UserNotification({ ...this.props(), readAt: now });
  }

  /** Marca como entregue (toast reivindicado); idempotente (mantem o primeiro `deliveredAt`). */
  public markDelivered(now: Date): UserNotification {
    return this.isPendingDelivery ? new UserNotification({ ...this.props(), deliveredAt: now }) : this;
  }

  private props(): UserNotificationPersistenceProps {
    return {
      id: this.id,
      userId: this.userId,
      source: this.source,
      title: this.title,
      message: this.message,
      createdAt: this.createdAt,
      deliveredAt: this.deliveredAt,
      readAt: this.readAt,
    };
  }

  private static build(props: UserNotificationPersistenceProps): UserNotification {
    if (!isValidUserNotificationSource(props.source)) {
      throw new InvalidUserNotificationError(`origem "${props.source}" fora do formato`);
    }
    const message = props.message.trim();
    if (message.length === 0 || message.length > MAX_MESSAGE) {
      throw new InvalidUserNotificationError(`mensagem precisa ter de 1 a ${MAX_MESSAGE} caracteres`);
    }
    const trimmedTitle = props.title?.trim() ?? '';
    if (trimmedTitle.length > MAX_TITLE) {
      throw new InvalidUserNotificationError(`titulo precisa ter no maximo ${MAX_TITLE} caracteres`);
    }
    return new UserNotification({
      ...props,
      title: trimmedTitle.length === 0 ? null : trimmedTitle,
      message,
    });
  }
}
