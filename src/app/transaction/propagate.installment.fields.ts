/**
 * O que uma edicao propaga para as demais parcelas do mesmo grupo (spec 020, RF-51).
 *
 * `categoryId` e `notes` sao atributos da COMPRA inteira: categorizar uma parcela categoriza
 * a compra toda. `amountCents`, `date` e `accountId` continuam sendo de cada parcela e nunca
 * propagam - sao intrinsecamente por ocorrencia (spec 009, RF-7).
 */
export interface InstallmentPropagation {
  /** Nova categoria a aplicar em todas as parcelas, ou `undefined` se a edicao nao a tocou. */
  readonly categoryId?: string;
  /** Novas notas a aplicar em todas as parcelas. Ausente quando a edicao nao as tocou. */
  readonly notes?: string | undefined;
}

/** A transacao editada, no minimo necessario para decidir a propagacao. */
interface EditedTransaction {
  readonly installmentGroupId: string | null;
  readonly categoryId: string;
  readonly notes: string | undefined;
}

/** O resultado ja resolvido da edicao (categoria resolvida, notas como vao ser gravadas). */
interface ResolvedEdit {
  readonly categoryId: string;
  readonly notes: string | undefined;
  /** `true` quando a entrada externa mexeu em `notes` (distinto de "notes continua null"). */
  readonly notesTouched: boolean;
}

/**
 * Decide o que propagar do lancamento editado para as irmas do grupo (spec 020, RF-51).
 *
 * Devolve `null` quando nao ha nada a propagar - seja porque a transacao nao e parcela
 * (`installmentGroupId === null`), seja porque a edicao nao mexeu em categoria nem em notas.
 * Quem chama usa esse `null` para evitar carregar o grupo a toa.
 *
 * A propagacao e **incondicional** (RF-51a): nao se compara com o valor atual de cada irma,
 * porque parcelas editadas individualmente antes devem ser sobrescritas do mesmo jeito.
 */
export function propagateInstallmentFields(
  existing: EditedTransaction,
  resolved: ResolvedEdit,
): InstallmentPropagation | null {
  if (existing.installmentGroupId === null) {
    return null;
  }

  const categoryChanged = resolved.categoryId !== existing.categoryId;
  // `notesTouched` e nao a comparacao de valor: editar as notas de UMA parcela para o mesmo
  // texto que ela ja tinha ainda deve alinhar as irmas que estivessem diferentes.
  const notesChanged = resolved.notesTouched;

  if (!categoryChanged && !notesChanged) {
    return null;
  }

  return {
    ...(categoryChanged ? { categoryId: resolved.categoryId } : {}),
    ...(notesChanged ? { notes: resolved.notes } : {}),
  };
}
