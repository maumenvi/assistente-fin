import { z } from 'zod';
import { InvalidInputError } from '../../shared/invalid.input.error.ts';
import { type AgentStorePort } from '../ports/store/agent.store.port.ts';
import { type ActiveRuns } from '../runs/active.runs.ts';
import { stopRunInputSchema } from './stop.run.input.schema.ts';

/** Quanto esperar a execucao terminar depois de pedir para parar. */
const SETTLE_TIMEOUT_MS = 1500;

/** Resultado de "parar": `stopped` e falso quando a execucao ja tinha terminado. */
export interface StopRunResult {
  readonly stopped: boolean;
}

/**
 * Para uma execucao em andamento (spec 031, T114, FR-019): aborta o `AbortController` registrado
 * pelo `SendMessage`; o runner encerra como `cancelled` e a mensagem do assistente fica
 * `interrupted` com o texto parcial. Idempotente: parar uma execucao que ja terminou (ou parar duas
 * vezes) e inofensivo. So o dono da execucao pode para-la.
 */
export class StopRunUseCase {
  private readonly store: AgentStorePort;
  private readonly runs: ActiveRuns;

  public constructor(store: AgentStorePort, runs: ActiveRuns) {
    this.store = store;
    this.runs = runs;
  }

  public async execute(rawInput: unknown): Promise<StopRunResult> {
    const parsed = stopRunInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('parar execucao', flat.fieldErrors, flat.formErrors);
    }
    const { userId, runId } = parsed.data;
    const run = await this.store.runs.get(userId, runId);
    if (run === null) return { stopped: false };
    if (!this.runs.cancel(runId)) return { stopped: false };
    await Promise.race([this.runs.settled(runId), new Promise<void>((resolve) => setTimeout(resolve, SETTLE_TIMEOUT_MS))]);
    return { stopped: true };
  }
}
