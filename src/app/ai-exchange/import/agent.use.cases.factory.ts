import { type Database } from '../../shared/database.port.ts';
import { type IdGenerator } from '../../shared/id.generator.port.ts';
import { type AgentUseCases } from './agent.use.cases.ts';

/**
 * Monta os casos de uso sobre um `Database` (normalmente uma transacao) e um gerador de ids
 * (derivado do lote, para os ids serem estaveis). Fornecida pela raiz de composicao.
 */
export type AgentUseCasesFactory = (database: Database, ids: IdGenerator) => AgentUseCases;
