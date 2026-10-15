import { type PreRegistration } from './pre.registration.entity.ts';

const WINDOW_MS = 10 * 60 * 1000;

function normalize(text: string | null): string {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Duplicatas da carteira gravadas antes da spec 027 (FR-009, research R7): pendentes de origem
 * `wallet` ainda sem `possibleDuplicateOf`, com o mesmo valor e o mesmo estabelecimento, criados
 * a ate 10 minutos do mais antigo do grupo. O mais recente passa a apontar para o mais antigo. So
 * marca - nunca apaga nem funde; quem decide e o usuario na aprovacao.
 */
export function markLegacyWalletDuplicates(
  pending: readonly PreRegistration[],
): { readonly id: string; readonly possibleDuplicateOf: string }[] {
  const candidates = pending
    .filter((pre) => pre.origin === 'wallet' && pre.amount !== null && !pre.duplicateReviewed)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  const marks: { id: string; possibleDuplicateOf: string }[] = [];
  const firsts: PreRegistration[] = [];
  for (const pre of candidates) {
    const original = firsts.find(
      (first) =>
        first.amount!.cents === pre.amount!.cents &&
        normalize(first.description) === normalize(pre.description) &&
        pre.createdAt.getTime() - first.createdAt.getTime() <= WINDOW_MS,
    );
    if (original === undefined) {
      firsts.push(pre);
      continue;
    }
    if (pre.possibleDuplicateOf === null) marks.push({ id: pre.id, possibleDuplicateOf: original.id });
  }
  return marks;
}
