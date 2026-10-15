import { z } from 'zod';
import { markLegacyWalletDuplicates } from '../../domain/pre-registration/mark.legacy.wallet.duplicates.ts';
import { StaleDataError } from '../shared/stale.data.error.ts';
import { type PreRegistration } from '../../domain/pre-registration/pre.registration.entity.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type PreRegistrationRepository } from './pre.registration.repository.port.ts';
import { type PendingConflictSource } from './pending.conflict.source.ts';
import { type PendingItem, type PendingItemKind } from './pending.item.ts';
import { listPreRegistrationsInputSchema } from './list.pre.registrations.input.schema.ts';

/** Resultado: itens (mais recentes primeiro) e contagem por tipo. */
export interface PendingItems {
  readonly items: readonly PendingItem[];
  readonly counts: Readonly<Record<PendingItemKind | 'all', number>>;
}

const ORIGIN_LABEL: Record<PreRegistration['origin'], string> = {
  manual: 'Anotado',
  nfce: 'Nota fiscal',
  receipt: 'Comprovante',
  wallet: 'Google Wallet',
  voice: 'Por voz',
  simulation: 'Da simulação',
};

function describe(pre: PreRegistration): { title: string; subtitle: string } {
  const amount = pre.amount === null ? null : `R$ ${(pre.amount.cents / 100).toFixed(2).replace('.', ',')}`;
  const title =
    pre.manualOnly ? 'Captura para cadastrar' : [pre.description ?? 'Compra', amount].filter(Boolean).join(' · ');
  return { title, subtitle: ORIGIN_LABEL[pre.origin] };
}

/**
 * Lista do sino (spec 022, FR-029): pre-registros pendentes, capturas que so tem o anexo
 * (cadastro manual) e conflitos de sincronizacao, com contagem por tipo para os filtros.
 */
export class ListPendingItemsUseCase {
  private readonly preRegistrations: PreRegistrationRepository;
  private readonly conflicts: PendingConflictSource | undefined;

  public constructor(preRegistrations: PreRegistrationRepository, conflicts?: PendingConflictSource) {
    this.preRegistrations = preRegistrations;
    this.conflicts = conflicts;
  }

  public async execute(rawInput: unknown): Promise<PendingItems> {
    const parsed = listPreRegistrationsInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('listar pendencias', flat.fieldErrors, flat.formErrors);
    }
    const { userId } = parsed.data;
    const [listed, conflicts] = await Promise.all([
      this.preRegistrations.listByUser(userId),
      this.conflicts?.listByUser(userId) ?? Promise.resolve([]),
    ]);
    const pres = await this.markLegacyDuplicates(listed);
    const items: PendingItem[] = [
      ...pres.map<PendingItem>((pre) => ({
        id: pre.id,
        kind: pre.manualOnly ? 'manual' : 'pre-registration',
        ...describe(pre),
        createdAt: pre.createdAt,
        missing: pre.missingForApproval(),
        possibleDuplicate: pre.possibleDuplicateOf !== null,
      })),
      ...conflicts.map<PendingItem>((conflict) => ({
        id: conflict.id,
        kind: 'conflict',
        title: `Conflito: ${conflict.entityLabel}`,
        subtitle: 'Alterado no celular e no desktop',
        createdAt: conflict.detectedAt,
        missing: [],
        possibleDuplicate: false,
      })),
    ].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const count = (kind: PendingItemKind) => items.filter((item) => item.kind === kind).length;
    return {
      items,
      counts: { all: items.length, 'pre-registration': count('pre-registration'), manual: count('manual'), conflict: count('conflict') },
    };
  }

  /**
   * Duplicatas da carteira gravadas antes da spec 027 (FR-009, R7): marca e salva
   * `possibleDuplicateOf`. Se o pre-registro mudou no meio (outra tela), so pula - a lista sai sem
   * a marca dele desta vez.
   */
  private async markLegacyDuplicates(pres: readonly PreRegistration[]): Promise<PreRegistration[]> {
    const marks = new Map(markLegacyWalletDuplicates(pres).map((mark) => [mark.id, mark.possibleDuplicateOf]));
    const result: PreRegistration[] = [];
    for (const pre of pres) {
      const duplicateOf = marks.get(pre.id);
      if (duplicateOf === undefined) {
        result.push(pre);
        continue;
      }
      const marked = pre.update({ possibleDuplicateOf: duplicateOf });
      try {
        await this.preRegistrations.save(marked);
        result.push(marked);
      } catch (error) {
        if (!(error instanceof StaleDataError)) throw error;
        result.push(pre);
      }
    }
    return result;
  }
}
