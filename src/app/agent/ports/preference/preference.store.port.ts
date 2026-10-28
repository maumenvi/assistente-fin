import { type Preference } from '../../../../domain/preference/preference.ts';
import { type PreferenceStatus } from '../../../../domain/preference/preference.status.ts';

/**
 * Preferencias do usuario (spec 032, contracts/preference.store.port.md). Toda consulta filtra
 * por `userId`; a lista sai em ordem estavel (`createdAt`, `id`).
 */
export interface PreferenceStorePort {
  /** Upsert: grava como recebido (quem muda o estado atualiza `updatedAt`). */
  save(preference: Preference): Promise<void>;
  get(userId: string, id: string): Promise<Preference | null>;
  list(userId: string, filter?: { readonly status?: readonly PreferenceStatus[] }): Promise<Preference[]>;
  /** Atomico: a perdedora vira `disabled` com `supersededBy`; `at` e o novo `updatedAt`. */
  supersede(userId: string, loserId: string, winnerId: string, at: string): Promise<void>;
  /** Marca o uso (`lastUsedAt`) SEM tocar `updatedAt`: nao dispara sync nem conflito. */
  markUsed(userId: string, ids: readonly string[], at: string): Promise<void>;
  /** A conversa de origem foi apagada: `sourceMessageRemoved = true`, sem tocar `updatedAt`. */
  markSourceRemoved(userId: string, conversationId: string): Promise<void>;
  delete(userId: string, id: string): Promise<void>;
  deleteAll(userId: string): Promise<void>;
}
