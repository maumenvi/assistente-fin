import { type AutonomyPolicy } from '../../../../domain/autonomy/autonomy.policy.ts';

/** Politica de autonomia do aparelho (spec 033). `get` devolve `null` quando nunca foi salva (o caso de uso aplica o padrao). */
export interface PolicyStorePort {
  get(userId: string): Promise<AutonomyPolicy | null>;
  save(policy: AutonomyPolicy): Promise<void>;
  deleteAll(userId: string): Promise<void>;
}
