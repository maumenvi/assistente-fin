import { Money } from '../shared/money.value.object.ts';
import { type CaptureDraft } from '../capture/capture.draft.ts';
import { type PreRegistration, type PreRegistrationEditableProps } from './pre.registration.entity.ts';

/**
 * Campos que uma atualizacao da mesma notificacao pode preencher num pre-registro existente
 * (spec 027, FR-003, research R3): so os que ainda estao vazios - valor, estabelecimento, data,
 * forma de pagamento e conta (ja resolvida pelo chamador). Nunca sobrescreve. Patch vazio = nada
 * a completar.
 */
export function fillMissingFromCapture(
  pre: PreRegistration,
  draft: CaptureDraft,
  resolvedAccountId: string | undefined,
): PreRegistrationEditableProps {
  const patch: { -readonly [K in keyof PreRegistrationEditableProps]: PreRegistrationEditableProps[K] } = {};
  if (pre.amount === null && draft.amountCents !== undefined) patch.amount = Money.fromCents(draft.amountCents);
  if (pre.description === null && draft.description !== undefined) patch.description = draft.description;
  if (pre.date === null && draft.date !== undefined) patch.date = new Date(draft.date);
  if (pre.paymentMethod === null && draft.paymentMethod !== undefined) patch.paymentMethod = draft.paymentMethod;
  if (pre.accountId === null && resolvedAccountId !== undefined) patch.accountId = resolvedAccountId;
  return patch;
}
