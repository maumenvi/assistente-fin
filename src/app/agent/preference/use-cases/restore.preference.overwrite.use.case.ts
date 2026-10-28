import { z } from 'zod';
import { PreferenceNotFoundError } from '../../../../domain/preference/errors/preference.not.found.error.ts';
import { type Preference } from '../../../../domain/preference/preference.ts';
import { type Clock } from '../../../shared/clock.port.ts';
import { InvalidInputError } from '../../../shared/invalid.input.error.ts';
import { type PreferenceStoresPort } from '../../ports/preference/preference.stores.port.ts';

const inputSchema = z.object({ userId: z.string().trim().min(1, 'userId obrigatorio'), overwriteId: z.string().trim().min(1) });

/**
 * "Restaurar" no aviso de sobrescrita (spec 032, FR-010): regrava o texto da versao perdida na
 * preferencia, com `updatedAt` novo (entao ela volta a vencer nos dois aparelhos), e marca o aviso
 * como visto. Se a preferencia foi apagada, nada a restaurar.
 */
export class RestorePreferenceOverwriteUseCase {
  private readonly stores: PreferenceStoresPort;
  private readonly clock: Clock;

  public constructor(stores: PreferenceStoresPort, clock: Clock) {
    this.stores = stores;
    this.clock = clock;
  }

  public async execute(rawInput: unknown): Promise<Preference> {
    const parsed = inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('restaurar preferencia', flat.fieldErrors, flat.formErrors);
    }
    const { userId, overwriteId } = parsed.data;
    const overwrite = await this.stores.overwrites.get(userId, overwriteId);
    if (overwrite === null) throw new PreferenceNotFoundError();
    const current = await this.stores.preferences.get(userId, overwrite.preferenceId);
    if (current === null) throw new PreferenceNotFoundError();
    const at = this.clock.now().toISOString();
    const restored: Preference = { ...current, text: overwrite.lostText, updatedAt: at };
    await this.stores.preferences.save(restored);
    await this.stores.overwrites.markSeen(userId, [overwriteId], at);
    return restored;
  }
}
