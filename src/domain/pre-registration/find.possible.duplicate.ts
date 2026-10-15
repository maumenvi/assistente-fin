/** O que se sabe do registro novo (pre-registro manual ou captura). */
export interface DuplicateCandidate {
  readonly dedupKey: string | null;
  /** Link da NFC-e, quando houver. */
  readonly link?: string | null | undefined;
  readonly amountCents: number | null;
  readonly date: Date | null;
  readonly description: string | null;
}

/** Pre-registro existente, na forma que a comparacao precisa. */
export interface ExistingPreRegistration {
  readonly id: string;
  readonly dedupKey: string | null;
  readonly amountCents: number | null;
  readonly date: Date | null;
  readonly description: string | null;
  readonly notes: string | null;
}

/** Lancamento existente, na forma que a comparacao precisa. */
export interface ExistingTransaction {
  readonly id: string;
  readonly amountCents: number;
  readonly date: Date;
  readonly notes: string | null | undefined;
}

function normalize(text: string | null | undefined): string {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

function sameUtcDay(a: Date, b: Date): boolean {
  return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}

/**
 * Procura um registro parecido com o novo (spec 022, FR-027): mesma chave de captura, mesmo
 * link de nota na observacao, ou mesmo valor + mesmo dia + mesma descricao. Devolve o id do
 * primeiro parecido ou `null`. So MARCA - nunca impede a criacao; a decisao e na aprovacao.
 */
export function findPossibleDuplicate(
  candidate: DuplicateCandidate,
  preRegistrations: readonly ExistingPreRegistration[],
  transactions: readonly ExistingTransaction[],
): string | null {
  if (candidate.dedupKey !== null) {
    const byKey = preRegistrations.find((pre) => pre.dedupKey === candidate.dedupKey);
    if (byKey) return byKey.id;
  }
  const link = candidate.link ?? null;
  if (link) {
    const byLink =
      preRegistrations.find((pre) => (pre.notes ?? '').includes(link)) ??
      transactions.find((tx) => (tx.notes ?? '').includes(link));
    if (byLink) return byLink.id;
  }
  const description = normalize(candidate.description);
  if (candidate.amountCents === null || candidate.date === null || description === '') return null;
  const date = candidate.date;
  const sameShape = (cents: number | null, when: Date | null, text: string | null | undefined) =>
    cents === candidate.amountCents && when !== null && sameUtcDay(when, date) && normalize(text) === description;
  return (
    preRegistrations.find((pre) => sameShape(pre.amountCents, pre.date, pre.description))?.id ??
    transactions.find((tx) => sameShape(tx.amountCents, tx.date, tx.notes))?.id ??
    null
  );
}
