import { PlanInvalidOperationError } from '../../../../domain/plan/errors/plan.invalid.operation.error.ts';
import { type Plan } from '../../../../domain/plan/plan.ts';
import { type PlanListFilter } from '../ports/plan.store.port.ts';
import { type AutonomyPolicy } from '../../../../domain/autonomy/autonomy.policy.ts';
import { getAutonomy, setAutonomy } from './autonomy.use.cases.ts';
import { confirmRuleSuggestion, deleteRule, dismissRuleSuggestion, listRules, updateRule } from '../rules/rule.use.cases.ts';
import { adjustPlan } from './adjust.plan.use.case.ts';
import { approvePlan, type ApprovePlanInput } from './approve.plan.use.case.ts';
import { expirePlans } from './expire.plans.ts';
import { loadPlan } from './engine.helpers.ts';
import { type PlanEngineDeps } from './plan.engine.deps.ts';
import { proposePlan, type ProposePlanInput, type ProposePlanResult } from './propose.plan.ts';
import { recoverPlans } from './recover.plans.ts';
import { rejectPlan } from './reject.plan.use.case.ts';
import { revertPlan, type RevertPlanResult } from './revert.plan.use.case.ts';

/** Fachada do motor de planos para as bordas e para a ferramenta `propose_changes` (spec 033). */
export class PlanService {
  private readonly maybeDeps: PlanEngineDeps | null;

  /** `null` = agente sem fiacao de escrita (testes que so leem): propor/aplicar falham com erro claro. */
  public constructor(deps: PlanEngineDeps | null) {
    this.maybeDeps = deps;
  }

  private get deps(): PlanEngineDeps {
    if (this.maybeDeps === null) throw new PlanInvalidOperationError('escrita nao configurada neste agente');
    return this.maybeDeps;
  }

  public async propose(input: ProposePlanInput): Promise<ProposePlanResult> {
    return proposePlan(this.deps, input);
  }

  public async approve(input: ApprovePlanInput): Promise<Plan> {
    return approvePlan(this.deps, input);
  }

  public async reject(userId: string, planId: string): Promise<Plan> {
    return rejectPlan(this.deps, userId, planId);
  }

  public async adjust(input: { userId: string; planId: string; itemId: string; edits: Readonly<Record<string, unknown>> }): Promise<Plan> {
    return adjustPlan(this.deps, input);
  }

  public async revert(input: { userId: string; planId: string; itemIds?: readonly string[] | undefined }): Promise<RevertPlanResult> {
    return revertPlan(this.deps, input);
  }

  public async get(userId: string, planId: string): Promise<Plan> {
    return loadPlan(this.deps, userId, planId);
  }

  public list(userId: string, filter?: PlanListFilter): Promise<Plan[]> {
    if (this.maybeDeps === null) return Promise.resolve([]);
    return this.deps.db.plans.plans.list(userId, filter);
  }

  /** Planos que uma execucao criou, para o detalhe da execucao (sem plano, lista vazia). */
  public async listByRun(userId: string, runId: string): Promise<{ planId: string; summary: string; status: Plan['status'] }[]> {
    if (this.maybeDeps === null) return [];
    const plans = await this.deps.db.plans.plans.listByRun(userId, runId);
    return plans.map((p) => ({ planId: p.id, summary: p.summary, status: p.status }));
  }

  // ---- regras de categorizacao (spec 033, FR-024..FR-026) ----

  private get ruleDeps() {
    return { db: this.deps.db, clock: this.deps.clock, ids: this.deps.ids };
  }

  public async listRules(userId: string) {
    return this.maybeDeps === null ? [] : await listRules(this.ruleDeps, userId);
  }

  public async confirmRuleSuggestion(input: unknown) {
    return await confirmRuleSuggestion(this.ruleDeps, input);
  }

  public async dismissRuleSuggestion(input: unknown): Promise<void> {
    await dismissRuleSuggestion(this.ruleDeps, input);
  }

  public async updateRule(input: unknown) {
    return await updateRule(this.ruleDeps, input);
  }

  public async deleteRule(input: unknown): Promise<void> {
    await deleteRule(this.ruleDeps, input);
  }

  /** Politica de autonomia do aparelho (padrao: nada automatico). */
  public async getAutonomy(userId: string): Promise<AutonomyPolicy> {
    return await getAutonomy(this.deps, userId);
  }

  /** Muda a politica; so a tela de configuracao chega aqui (o agente nao tem ferramenta para isto). */
  public async setAutonomy(input: unknown): Promise<AutonomyPolicy> {
    return await setAutonomy(this.deps, input);
  }

  /** Ao abrir a sessao: reaplica o que ficou `approved` no meio e expira o pendente vencido. */
  public async recoverAndExpire(userId: string): Promise<void> {
    if (this.maybeDeps === null) return;
    await recoverPlans(this.deps, userId);
    await expirePlans(this.deps, userId);
  }

  public expire(userId: string): Promise<number> {
    if (this.maybeDeps === null) return Promise.resolve(0);
    return expirePlans(this.deps, userId);
  }
}
