import { type ProjectionScenario } from '../../domain/scenario/projection.scenario.entity.ts';

/**
 * Porta de persistencia de cenarios de projecao (spec 002, RF-34..RF-36).
 *
 * Isolamento por usuario (RF-16) e responsabilidade do repositorio. `save` aplica a trava
 * otimista (RF-31): grava incondicional quando `scenario.updatedAt === null`, senao exige a
 * mesma versao lida ou lanca `StaleDataError`.
 */
export interface ScenarioRepository {
  /** Insere ou atualiza o cenario (chave: `scenario.id`). */
  save(scenario: ProjectionScenario): Promise<void>;

  /** Busca por id dentro do escopo do usuario. `null` se nao existir ou for de outro. */
  findById(userId: string, id: string): Promise<ProjectionScenario | null>;

  /** Lista os cenarios do usuario, ordenados por nome. */
  listByUser(userId: string): Promise<ProjectionScenario[]>;

  /** Remove o cenario do usuario. Silencioso se ele nao existir nesse escopo. */
  delete(userId: string, id: string): Promise<void>;
}
