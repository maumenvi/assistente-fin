import { AgentError } from '../../agent/errors/agent.error.ts';

/** Pedido de mudar autonomia ou privacidade pelo chat (FR-009): so a tela de configuracao muda. */
export class GuardedPolicyError extends AgentError {
  public constructor() {
    super('GUARDED_POLICY', 'autonomia e privacidade so mudam nas configuracoes');
  }
}
