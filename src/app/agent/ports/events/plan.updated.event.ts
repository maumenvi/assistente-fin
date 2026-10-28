import { type PlanStatus } from '../../../../domain/plan/plan.status.ts';
import { type AgentEventBase } from './agent.event.base.ts';

/**
 * Plano criado ou com estado novo (spec 033): a UI mostra/atualiza o cartao do plano na mensagem.
 * Quando nasce na execucao usa o `runId` dela; mudancas depois (aprovar, desfazer) chegam por
 * resposta direta das chamadas, nao por este evento.
 */
export interface PlanUpdatedEvent extends AgentEventBase {
  readonly type: 'plan_updated';
  readonly messageId: string;
  readonly planId: string;
  readonly status: PlanStatus;
}
