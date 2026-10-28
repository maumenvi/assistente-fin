import { type CapabilityUse } from '../../../../domain/capability/capability.use.ts';

/** Historico de uso das capacidades (retencao de 90 dias). */
export interface UseStorePort {
  append(use: CapabilityUse): Promise<void>;
  /** Mais recentes primeiro; `before` pagina por data. */
  listByCapability(userId: string, capabilityId: string, options: { readonly limit: number; readonly before?: string }): Promise<CapabilityUse[]>;
  /** Remove usos anteriores a `before`. */
  prune(userId: string, before: string): Promise<void>;
  deleteByCapability(userId: string, capabilityId: string): Promise<void>;
  deleteAll(userId: string): Promise<void>;
}
