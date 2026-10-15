import { type DataSnapshot } from '../../domain/scenario/data.snapshot.entity.ts';

/**
 * Porta de persistencia de snapshots / pontos de restauracao (spec 002, RF-37, RF-40a).
 *
 * Isolamento por usuario (RF-16). Sem trava otimista: snapshot nasce e some, nunca e
 * atualizado. Retencao 100% manual - o repositorio nao apaga nada sozinho.
 */
export interface DataSnapshotRepository {
  /** Insere o snapshot (chave: `snapshot.id`). */
  save(snapshot: DataSnapshot): Promise<void>;

  /** Busca por id dentro do escopo do usuario. `null` se nao existir ou for de outro. */
  findById(userId: string, id: string): Promise<DataSnapshot | null>;

  /** Lista os snapshots do usuario, do mais recente para o mais antigo. */
  listByUser(userId: string): Promise<DataSnapshot[]>;

  /** Remove o snapshot do usuario. Silencioso se ele nao existir nesse escopo. */
  delete(userId: string, id: string): Promise<void>;
}
