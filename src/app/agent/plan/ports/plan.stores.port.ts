import { type EvidenceStorePort } from './evidence.store.port.ts';
import { type PlanStorePort } from './plan.store.port.ts';
import { type PolicyStorePort } from './policy.store.port.ts';
import { type RuleStorePort } from './rule.store.port.ts';

/**
 * Armazenamento de planos, politica, regras e evidencias (spec 033), exposto como
 * `Database.plans`. Tres implementacoes: `fake`, `sqlite` (celular) e `prisma` (desktop). So
 * `rules` sincroniza.
 */
export interface PlanStoresPort {
  readonly plans: PlanStorePort;
  readonly policies: PolicyStorePort;
  readonly rules: RuleStorePort;
  readonly evidence: EvidenceStorePort;
  /** "Apagar tudo": planos, politica, regras e evidencias do usuario. */
  deleteAll(userId: string): Promise<void>;
}
