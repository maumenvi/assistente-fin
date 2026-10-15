import { type ScenarioApplication } from '../../domain/scenario/scenario.application.entity.ts';

/**
 * Porta de persistencia da aplicacao de cenario ("recibo", spec 002, RF-37, RF-38, RF-40).
 *
 * No maximo uma aplicacao ativa por usuario - a unicidade e garantida pelo `ApplyScenario`,
 * que consulta `findActiveByUser` antes de gravar. Sem trava otimista: a entidade nasce e
 * some, nunca e atualizada.
 */
export interface ScenarioApplicationRepository {
  /** Insere a aplicacao (chave: `application.id`). */
  save(application: ScenarioApplication): Promise<void>;

  /** Busca por id dentro do escopo do usuario. `null` se nao existir ou for de outro. */
  findById(userId: string, id: string): Promise<ScenarioApplication | null>;

  /** A aplicacao ativa do usuario, ou `null` se nao ha nenhuma. */
  findActiveByUser(userId: string): Promise<ScenarioApplication | null>;

  /** Remove a aplicacao do usuario. Silencioso se ela nao existir nesse escopo. */
  delete(userId: string, id: string): Promise<void>;
}
