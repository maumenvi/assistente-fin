import { type PreRegistrationOutcomeKind } from './pre.registration.outcome.kind.ts';

/**
 * Destino de um pre-registro removido (spec 027, R6), gravado na mesma transacao que o remove: e o
 * que permite dizer "ja foi lancada"/"foi descartado" em vez de um "nao encontrado" generico.
 */
export interface PreRegistrationOutcome {
  readonly userId: string;
  readonly preRegistrationId: string;
  readonly outcome: PreRegistrationOutcomeKind;
  /** Primeiro lancamento criado, quando aprovado. */
  readonly transactionId: string | null;
  readonly at: Date;
}
