import { type AgentToolDeps } from '../../tools/shared/agent.tool.deps.ts';
import { type OperationContext } from '../operations/operation.context.ts';

/** O que a verificacao enxerga alem do banco: o pedido do usuario, valores ja vistos e consultas de cartao. */
export interface VerifyContext extends OperationContext {
  /** Texto do pedido do usuario (base da deteccao de divergencia). */
  readonly userText: string;
  /** Valores (centavos) que consultas da execucao ja trouxeram; contam como "vistos". */
  readonly knownMoneyCents: ReadonlySet<number>;
  readonly deps: Pick<AgentToolDeps, 'calculateCreditCardAvailableLimit'>;
}
