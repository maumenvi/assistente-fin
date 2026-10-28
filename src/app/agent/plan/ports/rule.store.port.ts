import { type CategorizationRule } from '../../../../domain/plan/rule/categorization.rule.ts';

/** Regras de categorizacao (spec 033); a unica parte sincronizada. Ordenadas por `createdAt, id`. */
export interface RuleStorePort {
  save(rule: CategorizationRule): Promise<void>;
  get(userId: string, id: string): Promise<CategorizationRule | null>;
  list(userId: string): Promise<CategorizationRule[]>;
  findByMerchant(userId: string, merchant: string): Promise<CategorizationRule | null>;
  delete(userId: string, id: string): Promise<void>;
  deleteAll(userId: string): Promise<void>;
}
