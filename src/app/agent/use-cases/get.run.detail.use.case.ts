import { z } from 'zod';
import { type AgentRun } from '../../../domain/agent/agent.run.ts';
import { type RunStep } from '../../../domain/agent/run.step.ts';
import { InvalidInputError } from '../../shared/invalid.input.error.ts';
import { type PlanStatus } from '../../../domain/plan/plan.status.ts';
import { type AgentStorePort } from '../ports/store/agent.store.port.ts';

const inputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
  runId: z.string().trim().min(1, 'runId obrigatorio').max(100),
});

/** Execucao sem o checkpoint interno (`state`), que e detalhe de retomada e nao da tela. */
export type RunDetailRun = Omit<AgentRun, 'state'>;

/** Plano criado nesta execucao: o ponto de aprovacao mostrado no detalhe (spec 033, FR-028). */
export interface RunPlanRef {
  readonly planId: string;
  readonly summary: string;
  readonly status: PlanStatus;
}

/** Quem sabe dizer quais planos uma execucao criou (o motor de planos). */
export type PlansOfRun = (userId: string, runId: string) => Promise<readonly RunPlanRef[]>;

/** Execucao + passos ordenados + planos criados; `null` se nao existe (ou e de outro usuario). */
export interface RunDetail {
  readonly run: RunDetailRun;
  readonly steps: readonly RunStep[];
  readonly plans: readonly RunPlanRef[];
}

/** Detalhe de uma execucao: passos em ordem, com `request`/`response` ja truncados (marca `truncated`). */
export class GetRunDetailUseCase {
  private readonly store: AgentStorePort;
  private readonly plansOfRun: PlansOfRun | null;

  public constructor(store: AgentStorePort, plansOfRun: PlansOfRun | null = null) {
    this.store = store;
    this.plansOfRun = plansOfRun;
  }

  public async execute(rawInput: unknown): Promise<RunDetail | null> {
    const parsed = inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('ver execucao', flat.fieldErrors, flat.formErrors);
    }
    const { userId, runId } = parsed.data;
    const run = await this.store.runs.get(userId, runId);
    if (run === null) return null;
    const steps = [...(await this.store.steps.list(userId, runId))].sort((a, b) => a.seq - b.seq);
    const { state: _state, ...rest } = run;
    const plans = this.plansOfRun === null ? [] : await this.plansOfRun(userId, runId).catch(() => []);
    return { run: rest, steps, plans };
  }
}
