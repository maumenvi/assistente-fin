import { type QuerySummary } from '../../../../domain/agent/query.summary.ts';
import { type AgentEventBase } from './agent.event.base.ts';

/** Uma consulta foi feita: vira o cartao "Consultei: ...". */
export interface QueryCardEvent extends AgentEventBase {
  readonly type: 'query_card';
  readonly messageId: string;
  readonly summary: QuerySummary;
}
