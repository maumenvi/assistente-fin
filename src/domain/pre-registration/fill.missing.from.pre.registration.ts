import { type PreRegistration, type PreRegistrationEditableProps } from './pre.registration.entity.ts';

/**
 * "Juntar" duplicatas (spec 028, FR-018): campos que o pre-registro mantido ainda tem vazios,
 * preenchidos com o primeiro dos `others` (na ordem recebida) que os tenha. Nunca sobrescreve.
 * Parcelas so entram se a forma de pagamento final for credito. Patch vazio = nada a completar.
 */
export function fillMissingFromPreRegistration(
  target: PreRegistration,
  others: readonly PreRegistration[],
): PreRegistrationEditableProps {
  const patch: { -readonly [K in keyof PreRegistrationEditableProps]: PreRegistrationEditableProps[K] } = {};
  const firstWith = <T>(pick: (pre: PreRegistration) => T | null): T | null => {
    for (const other of others) {
      const value = pick(other);
      if (value !== null) return value;
    }
    return null;
  };
  if (target.amount === null) patch.amount = firstWith((pre) => pre.amount);
  if (target.description === null) patch.description = firstWith((pre) => pre.description);
  if (target.date === null) patch.date = firstWith((pre) => pre.date);
  if (target.paymentMethod === null) patch.paymentMethod = firstWith((pre) => pre.paymentMethod);
  if (target.accountId === null) patch.accountId = firstWith((pre) => pre.accountId);
  if (target.categoryId === null) patch.categoryId = firstWith((pre) => pre.categoryId);
  if (target.notes === null) patch.notes = firstWith((pre) => pre.notes);
  if (target.installments === null && (patch.paymentMethod ?? target.paymentMethod) === 'credit-card') {
    patch.installments = firstWith((pre) => pre.installments);
  }
  for (const key of Object.keys(patch) as (keyof typeof patch)[]) {
    if (patch[key] === null) delete patch[key];
  }
  return patch;
}
