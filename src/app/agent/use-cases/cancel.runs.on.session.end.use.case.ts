import { z } from 'zod';
import { InvalidInputError } from '../../shared/invalid.input.error.ts';
import { type AfterTurnHooks } from '../after.turn.hooks.ts';
import { type ActiveRuns } from '../runs/active.runs.ts';

const inputSchema = z.object({ userId: z.string().trim().min(1, 'userId obrigatorio') });

/** Quanto esperar as execucoes canceladas terminarem. */
const SETTLE_TIMEOUT_MS = 1500;

/**
 * Fim da sessao de um usuario (logout, troca de usuario, bloqueio) - spec 031, T118: cancela as
 * execucoes ativas dele e as SILENCIA (nenhum evento mais e publicado, nenhuma chamada de rede
 * continua). Segredos nao ficam em cache de memoria: a chave e lida do cofre a cada execucao.
 */
export class CancelRunsOnSessionEndUseCase {
  private readonly runs: ActiveRuns;
  private readonly hooks: AfterTurnHooks | undefined;

  public constructor(runs: ActiveRuns, hooks?: AfterTurnHooks) {
    this.runs = runs;
    this.hooks = hooks;
  }

  public async execute(rawInput: unknown): Promise<{ cancelled: number }> {
    const parsed = inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('encerrar execucoes da sessao', flat.fieldErrors, flat.formErrors);
    }
    this.hooks?.cancelUser(parsed.data.userId);
    const ids = this.runs.cancelUser(parsed.data.userId);
    await Promise.race([Promise.all(ids.map((id) => this.runs.settled(id))), new Promise<void>((resolve) => setTimeout(resolve, SETTLE_TIMEOUT_MS))]);
    return { cancelled: ids.length };
  }
}
