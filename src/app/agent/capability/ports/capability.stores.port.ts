import { type CapabilityStorePort } from './capability.store.port.ts';
import { type RequestStorePort } from './request.store.port.ts';
import { type SkillFileStorePort } from './skill.file.store.port.ts';
import { type UseStorePort } from './use.store.port.ts';

/**
 * Armazenamento das capacidades dinamicas (spec 034), exposto como `Database.capabilities`. Tres
 * implementacoes: `fake`, `sqlite` (celular) e `prisma` (desktop). NADA sincroniza nem entra no backup.
 */
export interface CapabilityStoresPort {
  readonly capabilities: CapabilityStorePort;
  readonly requests: RequestStorePort;
  readonly uses: UseStorePort;
  readonly skillFiles: SkillFileStorePort;
  /** "Apagar tudo": capacidades, pedidos, usos e arquivos do usuario. */
  deleteAll(userId: string): Promise<void>;
}
