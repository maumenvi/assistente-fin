import { type PreRegistration } from '../../domain/pre-registration/pre.registration.entity.ts';

/**
 * Porta de persistencia dos pre-registros (spec 022, FR-021: tabela separada dos lancamentos).
 * `save` segue a trava otimista do app (spec 002, RF-31).
 */
export interface PreRegistrationRepository {
  save(preRegistration: PreRegistration): Promise<void>;
  findById(userId: string, id: string): Promise<PreRegistration | null>;
  /** Pendentes do usuario, mais recentes primeiro. */
  listByUser(userId: string): Promise<PreRegistration[]>;
  /** Quantos pendentes o usuario tem (sino, FR-028). */
  countPending(userId: string): Promise<number>;
  /** Pre-registros com a mesma chave de captura (nao e unica, FR-027). */
  findByDedupKey(userId: string, dedupKey: string): Promise<PreRegistration[]>;
  delete(userId: string, id: string): Promise<void>;
}
