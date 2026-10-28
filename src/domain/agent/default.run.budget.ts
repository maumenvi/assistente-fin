import { type RunBudget } from './run.budget.ts';

/** Teto padrao de tokens por pedido quando nao customizado no perfil da LLM (spec 038, FR-007/FR-008). */
export const DEFAULT_MAX_TOKENS = 24_000;

/** Orcamento padrao de uma execucao: 40 passos, 5 min e US$ 1,00 (ampliado na spec 040; antes 12 passos, 60 s e US$ 0,10). */
export const DEFAULT_RUN_BUDGET: RunBudget = Object.freeze({
  maxSteps: 40,
  maxMs: 300_000,
  maxCostMicroUsd: 1_000_000,
});

/** Padrao antigo (specs 031-039): quem nunca mexeu nos limites tem isto guardado e passa a usar o novo padrao. */
export const LEGACY_RUN_BUDGET: RunBudget = Object.freeze({ maxSteps: 12, maxMs: 60_000, maxCostMicroUsd: 100_000 });
