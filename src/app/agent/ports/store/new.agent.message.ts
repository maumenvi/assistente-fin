import { type AgentMessage } from '../../../../domain/agent/agent.message.ts';

/** Mensagem a gravar: o `seq` e atribuido pelo armazenamento (crescente, sem lacunas, por conversa). */
export type NewAgentMessage = Omit<AgentMessage, 'seq'>;
