import { type SyncOp } from '../sync/sync.op.ts';
import { type SyncOpResult } from '../sync/sync.op.result.ts';
import { type EmitUserNotificationUseCase } from './emit.user.notification.use.case.ts';
import { MOBILE_CAPTURE_NOTIFICATION_SOURCE } from './mobile.capture.notification.source.ts';
import { selectNewCaptures } from './select.new.captures.ts';
import { describeNewCaptures } from './describe.new.captures.ts';

/** Lote de push ja aplicado no hub, do aparelho do `userId`. */
export interface AppliedPushBatch {
  readonly userId: string;
  readonly ops: readonly SyncOp[];
  readonly results: readonly SyncOpResult[];
}

/**
 * Caso de uso "notificar capturas do celular" (spec 013, RF-12, research R11): depois que o hub
 * aplica um lote, emite NO MAXIMO uma notificacao (`mobile-capture`) com as capturas novas -
 * individual com uma, resumo com varias. Sem captura nova, nao emite nada.
 */
export class NotifyMobileCapturesUseCase {
  private readonly emit: EmitUserNotificationUseCase;

  public constructor(emit: EmitUserNotificationUseCase) {
    this.emit = emit;
  }

  public async execute(batch: AppliedPushBatch): Promise<void> {
    const description = describeNewCaptures(selectNewCaptures(batch.ops, batch.results));
    if (description === null) return;
    await this.emit.execute({
      userId: batch.userId,
      source: MOBILE_CAPTURE_NOTIFICATION_SOURCE,
      title: description.title,
      message: description.message,
    });
  }
}
