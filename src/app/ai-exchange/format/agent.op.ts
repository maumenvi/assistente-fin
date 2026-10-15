import { type AgentEntity } from './agent.entity.ts';
import { type AgentOpKind } from './agent.op.kind.ts';

/** Uma operacao do bloco ja validada na forma (spec 029, data-model.md §1). */
export interface AgentOp {
  /** Obrigatorio em `create`; unico no lote. Dele deriva o id da entidade criada. */
  readonly ref?: string | undefined;
  readonly kind: AgentOpKind;
  readonly entity: AgentEntity;
  /** Obrigatorio em `update`, `pay`, `delete` e `cancelRemaining`. */
  readonly id?: string | undefined;
  /** Campos da entidade; validados contra o caso de uso correspondente no plano. */
  readonly data?: Readonly<Record<string, unknown>> | undefined;
  /** Versao (`updatedAt` ISO) que o agente viu; base do aviso de desatualizado. */
  readonly expectV?: string | undefined;
  readonly confirm?: true | undefined;
}
