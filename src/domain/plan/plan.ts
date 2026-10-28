import { type PlanApplication } from './plan.application.ts';
import { type PlanItem } from './plan.item.ts';
import { type RuleSuggestion } from './rule/rule.suggestion.ts';
import { type PlanStatus } from './plan.status.ts';

/** Plano de alteracao proposto pelo agente e decidido pelo usuario ou pela politica (spec 033). */
export interface Plan {
  readonly id: string;
  readonly userId: string;
  readonly conversationId: string;
  readonly runId: string | null;
  readonly messageId: string | null;
  readonly status: PlanStatus;
  /** Quem decidiu: o usuario ou a politica de autonomia. */
  readonly origin: 'user' | 'policy';
  readonly summary: string;
  /** Pedido original; base da verificacao de divergencia. */
  readonly userText: string;
  readonly items: readonly PlanItem[];
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly decidedAt: string | null;
  readonly appliedAt: string | null;
  readonly revertUntil: string | null;
  readonly revertedAt: string | null;
  readonly lastError: string | null;
  readonly applications: readonly PlanApplication[];
  /** Regras que o assistente sugere depois de aprovada a mesma categorizacao varias vezes (opcional: planos antigos nao tem). */
  readonly ruleSuggestions?: readonly RuleSuggestion[];
}
