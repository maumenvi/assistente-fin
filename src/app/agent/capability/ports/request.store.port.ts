import { type CapabilityRequest } from '../../../../domain/capability/capability.request.ts';

/** Pedidos de capacidade (cartoes de aprovacao). */
export interface RequestStorePort {
  save(request: CapabilityRequest): Promise<void>;
  get(userId: string, id: string): Promise<CapabilityRequest | null>;
  /** `pending`, mais recentes primeiro. */
  listPending(userId: string): Promise<CapabilityRequest[]>;
  /** `pending` com `expiresAt` <= `now`. */
  listExpired(userId: string, now: string): Promise<CapabilityRequest[]>;
  deleteAll(userId: string): Promise<void>;
}
