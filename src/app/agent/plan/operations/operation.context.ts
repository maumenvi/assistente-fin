import { type Database } from '../../../shared/database.port.ts';
import { type AgentWriters } from '../../../../composition/build.agent.writers.ts';

/** O que uma operacao enxerga ao montar e verificar o item: leitura do banco do usuario. */
export interface OperationContext {
  readonly userId: string;
  readonly now: Date;
  readonly db: Database;
}

/** O que `apply` recebe: os escritores ligados ao `tx` da aplicacao atomica. */
export interface ApplyContext extends OperationContext {
  readonly writers: AgentWriters;
}
