import { z } from 'zod';
import { InvalidInputError } from '../../shared/invalid.input.error.ts';
import { type AgentStorePort } from '../ports/store/agent.store.port.ts';
import { listRunsInputSchema } from './list.runs.input.schema.ts';
import { type RunListResult } from './run.list.result.ts';

/** Lista as execucoes do usuario (mais recentes primeiro) com filtros e os totais da pagina (spec 031, FR-040). */
export class ListRunsUseCase {
  private readonly store: AgentStorePort;

  public constructor(store: AgentStorePort) {
    this.store = store;
  }

  public async execute(rawInput: unknown): Promise<RunListResult> {
    const parsed = listRunsInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('listar execucoes', flat.fieldErrors, flat.formErrors);
    }
    const { userId, status, model, limit, before } = parsed.data;
    const runs = await this.store.runs.list(userId, {
      limit,
      ...(status === undefined ? {} : { status }),
      ...(model === undefined ? {} : { model }),
      ...(before === undefined ? {} : { before }),
    });
    const costs = runs.map((r) => r.consumed.costMicroUsd);
    return {
      runs,
      totals: {
        count: runs.length,
        ms: runs.reduce((sum, r) => sum + r.consumed.ms, 0),
        inputTokens: runs.reduce((sum, r) => sum + r.consumed.inputTokens, 0),
        outputTokens: runs.reduce((sum, r) => sum + r.consumed.outputTokens, 0),
        costMicroUsd: costs.some((c) => c === null) ? null : costs.reduce<number>((sum, c) => sum + (c ?? 0), 0),
      },
      next: runs.length === limit ? (runs.at(-1)?.startedAt ?? null) : null,
    };
  }
}
