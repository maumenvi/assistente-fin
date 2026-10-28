import { type Capability } from '../../../../domain/capability/capability.ts';
import { type CapabilityStatus } from '../../../../domain/capability/capability.status.ts';

/** Capacidades aprovadas (spec 034). Locais ao aparelho; todo acesso filtra por `userId`; `slug` unico por usuario. */
export interface CapabilityStorePort {
  /** Upsert por `id`. */
  save(capability: Capability): Promise<void>;
  get(userId: string, id: string): Promise<Capability | null>;
  getBySlug(userId: string, slug: string): Promise<Capability | null>;
  /** Mais recentes primeiro (por `approvedAt`). */
  list(userId: string, filter?: { readonly status?: readonly CapabilityStatus[] }): Promise<Capability[]>;
  delete(userId: string, id: string): Promise<void>;
}
