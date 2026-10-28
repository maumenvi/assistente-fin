import { type PlanFlag } from '../../../../domain/plan/plan.flag.ts';

/**
 * Resultado da verificacao de forma e entidades: alertas (o item segue, desmarcado) ou motivo de
 * invalidez (o item nao entra no plano e o modelo recebe o erro para corrigir).
 */
export type OperationValidation = { readonly flags: readonly PlanFlag[] } | { readonly invalid: string };

export function isInvalid(result: OperationValidation): result is { readonly invalid: string } {
  return 'invalid' in result;
}
