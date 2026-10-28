import { z } from 'zod';
import { parsePreferenceInput } from './parse.preference.input.ts';
import { type PreferenceUseCaseDeps } from './preference.use.case.deps.ts';

const inputSchema = z.object({ userId: z.string().trim().min(1), ids: z.array(z.string().trim().min(1).max(200)).max(100) });

/** Marca avisos de sobrescrita como vistos (a tela os mostrou ou o usuario os dispensou). */
export class MarkNoticesSeenUseCase {
  private readonly deps: PreferenceUseCaseDeps;

  public constructor(deps: PreferenceUseCaseDeps) {
    this.deps = deps;
  }

  public async execute(rawInput: unknown): Promise<void> {
    const { userId, ids } = parsePreferenceInput(inputSchema, rawInput, 'marcar avisos como vistos');
    await this.deps.stores.overwrites.markSeen(userId, ids, this.deps.clock.now().toISOString());
  }
}
