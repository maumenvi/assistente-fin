import { z } from 'zod';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type Clock } from '../shared/clock.port.ts';
import { type SyncOutbox } from './sync.outbox.port.ts';
import { UnpairPendingError } from './unpair.pending.error.ts';

const inputSchema = z.object({ keepPendingDetached: z.boolean().default(false) });

/**
 * Despareamento no celular (spec 022, T122; FR-008a): volta ao modo independente COM os dados
 * locais. Se sobrou alteracao nao enviada (quem chama tenta sincronizar antes), so segue com
 * `keepPendingDetached: true` - e nada se perde (spec 024, FR-012/FR-013): os registros ficam no
 * celular e a lista do que nao chegou ao desktop vai para `sync_detached`, para o proximo
 * pareamento com "enviar" reenviar ou apresentar como conflito. Apaga outbox, versoes-base,
 * conflitos e cursor; o token e a chave do aparelho sao apagados por quem chama.
 */
export class UnpairDeviceUseCase {
  private readonly outbox: SyncOutbox;
  private readonly clock: Clock;

  public constructor(outbox: SyncOutbox, clock: Clock) {
    this.outbox = outbox;
    this.clock = clock;
  }

  public async execute(raw: unknown): Promise<void> {
    const parsed = inputSchema.safeParse(raw ?? {});
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('desparear', flat.fieldErrors, flat.formErrors);
    }
    const pending = await this.outbox.pendingCount();
    if (pending > 0 && !parsed.data.keepPendingDetached) throw new UnpairPendingError(pending);
    if (pending > 0) await this.outbox.detachPending(this.clock.now());
    await this.outbox.reset();
  }
}
