import { type QuerySummary } from './query.summary.ts';

/** Parte "Consultei: ..." de uma mensagem do assistente. */
export interface QueryPart {
  readonly type: 'query';
  readonly summary: QuerySummary;
}
