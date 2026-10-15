import { Money } from '../../domain/shared/money.value.object.ts';
import { type PreRegistrationEditableProps } from '../../domain/pre-registration/pre.registration.entity.ts';
import { type PaymentMethod } from '../../domain/simulation/payment.method.ts';

/** Campos editaveis como chegam da fronteira (ver `preRegistrationFieldsSchema`). */
export interface PreRegistrationFieldsInput {
  readonly amountCents?: number | null | undefined;
  readonly description?: string | null | undefined;
  readonly date?: string | null | undefined;
  readonly accountId?: string | null | undefined;
  readonly paymentMethod?: PaymentMethod | null | undefined;
  readonly installments?: number | null | undefined;
  readonly categoryId?: string | null | undefined;
  readonly notes?: string | null | undefined;
  readonly needsReview?: boolean | undefined;
}

/**
 * Converte a entrada da fronteira em patch da entidade: campo ausente nao mexe, `null` limpa.
 */
export function toPreRegistrationPatch(input: PreRegistrationFieldsInput): PreRegistrationEditableProps {
  const patch: Record<string, unknown> = {};
  if (input.amountCents !== undefined) patch['amount'] = input.amountCents === null ? null : Money.fromCents(input.amountCents);
  if (input.date !== undefined) patch['date'] = input.date === null ? null : new Date(input.date);
  for (const key of ['description', 'accountId', 'paymentMethod', 'installments', 'categoryId', 'notes', 'needsReview'] as const) {
    if (input[key] !== undefined) patch[key] = input[key];
  }
  return patch as PreRegistrationEditableProps;
}
