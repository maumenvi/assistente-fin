import { z } from 'zod';
import { InvalidInputError } from '../../shared/invalid.input.error.ts';
import { type Clock } from '../../shared/clock.port.ts';
import { type AgentSettingsPort } from '../ports/settings/agent.settings.port.ts';
import { type AgentStorePort } from '../ports/store/agent.store.port.ts';
import { recoverRunsInputSchema } from './recover.runs.input.schema.ts';

/** Folga somada ao tempo maximo de uma execucao antes de considera-la morta. */
const GRACE_MS = 30_000;

/** Corte minimo sem batimento: nunca menor que 90 s. */
const MIN_CUTOFF_MS = 90_000;

/** Resultado: quantas execucoes e mensagens foram marcadas como interrompidas. */
export interface RecoverRunsResult {
  readonly recovered: number;
}

/**
 * Retomada apos a morte do processo no meio de uma execucao (spec 031, T116, FR-018/SC-003): ao
 * abrir a sessao, execucoes `running` sem batimento ha mais de `maxMs + 30 s` (minimo 90 s) viram
 * `interrupted` e a mensagem em `streaming` delas tambem - com o texto parcial preservado. NAO
 * refaz a resposta (nada duplica): o usuario escolhe "Tentar de novo". Idempotente.
 */
export class RecoverRunsUseCase {
  private readonly store: AgentStorePort;
  private readonly settings: AgentSettingsPort;
  private readonly clock: Clock;

  public constructor(store: AgentStorePort, settings: AgentSettingsPort, clock: Clock) {
    this.store = store;
    this.settings = settings;
    this.clock = clock;
  }

  public async execute(rawInput: unknown): Promise<RecoverRunsResult> {
    const parsed = recoverRunsInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('recuperar execucoes', flat.fieldErrors, flat.formErrors);
    }
    const { userId } = parsed.data;
    const { limits } = await this.settings.read(userId);
    const cutoffMs = Math.max(MIN_CUTOFF_MS, limits.maxMs + GRACE_MS);
    const olderThan = new Date(this.clock.now().getTime() - cutoffMs).toISOString();
    const stale = await this.store.runs.markStaleInterrupted(userId, olderThan);
    for (const run of stale) {
      await this.store.messages.update(userId, run.assistantMessageId, { status: 'interrupted' });
    }
    return { recovered: stale.length };
  }
}
