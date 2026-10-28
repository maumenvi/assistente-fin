import { DEFAULT_RUN_BUDGET } from '../../../../domain/agent/default.run.budget.ts';
import { type RunBudget } from '../../../../domain/agent/run.budget.ts';

/** Limites por pedido como os campos da tela os editam (texto). */
export interface LimitsForm {
  readonly steps: string;
  readonly seconds: string;
  /** Dolares com virgula ou ponto: "0,10". */
  readonly costUsd: string;
}

/** Resultado da leitura dos campos de limites. */
export type LimitsParse =
  | { readonly ok: true; readonly budget: RunBudget }
  | { readonly ok: false; readonly errors: readonly string[] };

function formatUsd(micro: number): string {
  return (micro / 1_000_000).toFixed(2).replace('.', ',');
}

/** Orcamento -> campos da tela. */
export function limitsFormFromBudget(budget: RunBudget): LimitsForm {
  return { steps: String(budget.maxSteps), seconds: String(Math.round(budget.maxMs / 1000)), costUsd: formatUsd(budget.maxCostMicroUsd) };
}

/** Campos padrao (40 passos, 300 s, US$ 1,00). */
export function defaultLimitsForm(): LimitsForm {
  return limitsFormFromBudget(DEFAULT_RUN_BUDGET);
}

/** Campos da tela -> orcamento, ou os erros em pt-BR (1-100 passos, 5-1800 s, US$ 0,01-20,00). */
export function parseLimitsForm(form: LimitsForm): LimitsParse {
  const errors: string[] = [];
  const steps = Number(form.steps.trim());
  const seconds = Number(form.seconds.trim());
  // "1.234,56" (ponto de milhar + virgula) ou "0.10" / "0,10" (um separador decimal)
  const rawUsd = form.costUsd.trim();
  const usd = Number(rawUsd.includes(',') ? rawUsd.replace(/\./g, '').replace(',', '.') : rawUsd);
  if (!Number.isInteger(steps) || steps < 1 || steps > 100) errors.push('Passos: informe um número inteiro de 1 a 100.');
  if (!Number.isInteger(seconds) || seconds < 5 || seconds > 1800) errors.push('Tempo: informe de 5 a 1800 segundos.');
  if (form.costUsd.trim() === '' || !Number.isFinite(usd) || usd < 0.01 || usd > 20) errors.push('Custo máximo: informe de US$ 0,01 a US$ 20,00.');
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, budget: { maxSteps: steps, maxMs: seconds * 1000, maxCostMicroUsd: Math.round(usd * 1_000_000) } };
}
