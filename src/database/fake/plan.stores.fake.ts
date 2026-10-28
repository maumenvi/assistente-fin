import { type EvidenceStorePort } from '../../app/agent/plan/ports/evidence.store.port.ts';
import { type PlanListFilter, type PlanStorePort } from '../../app/agent/plan/ports/plan.store.port.ts';
import { type PlanStoresPort } from '../../app/agent/plan/ports/plan.stores.port.ts';
import { type PolicyStorePort } from '../../app/agent/plan/ports/policy.store.port.ts';
import { type RuleStorePort } from '../../app/agent/plan/ports/rule.store.port.ts';
import { type AutonomyPolicy } from '../../domain/autonomy/autonomy.policy.ts';
import { type Plan } from '../../domain/plan/plan.ts';
import { type CategorizationRule } from '../../domain/plan/rule/categorization.rule.ts';
import { type CorrectionEvidence } from '../../domain/plan/rule/correction.evidence.ts';

const DEFAULT_LIMIT = 50;

class FakePlanStore implements PlanStorePort {
  public readonly rows = new Map<string, Plan>();

  public save(plan: Plan): Promise<void> {
    this.rows.set(plan.id, structuredClone(plan));
    return Promise.resolve();
  }

  public get(userId: string, id: string): Promise<Plan | null> {
    const found = this.rows.get(id);
    return Promise.resolve(found && found.userId === userId ? structuredClone(found) : null);
  }

  public list(userId: string, filter?: PlanListFilter): Promise<Plan[]> {
    const rows = [...this.rows.values()]
      .filter((p) => p.userId === userId && (filter?.status === undefined || filter.status.includes(p.status)) && (filter?.before === undefined || p.createdAt < filter.before))
      .sort((a, b) => (a.createdAt === b.createdAt ? b.id.localeCompare(a.id) : b.createdAt.localeCompare(a.createdAt)))
      .slice(0, filter?.limit ?? DEFAULT_LIMIT);
    return Promise.resolve(structuredClone(rows));
  }

  public listByRun(userId: string, runId: string): Promise<Plan[]> {
    const rows = [...this.rows.values()].filter((p) => p.userId === userId && p.runId === runId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return Promise.resolve(structuredClone(rows));
  }

  public listApproved(userId: string): Promise<Plan[]> {
    return this.list(userId, { status: ['approved'], limit: 1000 });
  }

  public listPendingExpired(userId: string, now: string): Promise<Plan[]> {
    const rows = [...this.rows.values()].filter((p) => p.userId === userId && p.status === 'pending' && p.expiresAt <= now);
    return Promise.resolve(structuredClone(rows));
  }

  public deleteAll(userId: string): Promise<void> {
    for (const [id, p] of [...this.rows]) if (p.userId === userId) this.rows.delete(id);
    return Promise.resolve();
  }
}

class FakePolicyStore implements PolicyStorePort {
  public readonly rows = new Map<string, AutonomyPolicy>();

  public get(userId: string): Promise<AutonomyPolicy | null> {
    const found = this.rows.get(userId);
    return Promise.resolve(found ? structuredClone(found) : null);
  }

  public save(policy: AutonomyPolicy): Promise<void> {
    this.rows.set(policy.userId, structuredClone(policy));
    return Promise.resolve();
  }

  public deleteAll(userId: string): Promise<void> {
    this.rows.delete(userId);
    return Promise.resolve();
  }
}

class FakeRuleStore implements RuleStorePort {
  public readonly rows = new Map<string, CategorizationRule>();

  public save(rule: CategorizationRule): Promise<void> {
    this.rows.set(rule.id, { ...rule });
    return Promise.resolve();
  }

  public get(userId: string, id: string): Promise<CategorizationRule | null> {
    const found = this.rows.get(id);
    return Promise.resolve(found && found.userId === userId ? { ...found } : null);
  }

  public list(userId: string): Promise<CategorizationRule[]> {
    const rows = [...this.rows.values()]
      .filter((r) => r.userId === userId)
      .sort((a, b) => (a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt.localeCompare(b.createdAt)));
    return Promise.resolve(rows.map((r) => ({ ...r })));
  }

  public async findByMerchant(userId: string, merchant: string): Promise<CategorizationRule | null> {
    return (await this.list(userId)).find((r) => r.merchant === merchant) ?? null;
  }

  public delete(userId: string, id: string): Promise<void> {
    const found = this.rows.get(id);
    if (found && found.userId === userId) this.rows.delete(id);
    return Promise.resolve();
  }

  public deleteAll(userId: string): Promise<void> {
    for (const [id, r] of [...this.rows]) if (r.userId === userId) this.rows.delete(id);
    return Promise.resolve();
  }
}

class FakeEvidenceStore implements EvidenceStorePort {
  public rows: CorrectionEvidence[] = [];

  public append(evidence: CorrectionEvidence): Promise<void> {
    this.rows.push({ ...evidence });
    return Promise.resolve();
  }

  public listByMerchant(userId: string, merchant: string, since: string): Promise<CorrectionEvidence[]> {
    return Promise.resolve(
      this.rows.filter((r) => r.userId === userId && r.merchant === merchant && r.at >= since).sort((a, b) => b.at.localeCompare(a.at)).map((r) => ({ ...r })),
    );
  }

  public prune(userId: string, before: string, max: number): Promise<void> {
    const mine = this.rows.filter((r) => r.userId === userId && r.at >= before).sort((a, b) => b.at.localeCompare(a.at)).slice(0, max);
    this.rows = [...this.rows.filter((r) => r.userId !== userId), ...mine];
    return Promise.resolve();
  }

  public deleteAll(userId: string): Promise<void> {
    this.rows = this.rows.filter((r) => r.userId !== userId);
    return Promise.resolve();
  }
}

/** Planos, politica, regras e evidencias em memoria (testes e evals; spec 033). */
export class FakePlanStores implements PlanStoresPort {
  public readonly plans = new FakePlanStore();
  public readonly policies = new FakePolicyStore();
  public readonly rules = new FakeRuleStore();
  public readonly evidence = new FakeEvidenceStore();

  public async deleteAll(userId: string): Promise<void> {
    await this.plans.deleteAll(userId);
    await this.policies.deleteAll(userId);
    await this.rules.deleteAll(userId);
    await this.evidence.deleteAll(userId);
  }
}
