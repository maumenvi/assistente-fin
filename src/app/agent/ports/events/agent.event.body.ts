import { type AgentEvent } from './agent.event.ts';

/** Evento sem os campos que o runner carimba (`runId`, `conversationId`, `seq`). */
export type AgentEventBody = AgentEvent extends infer E ? (E extends AgentEvent ? Omit<E, 'runId' | 'conversationId' | 'seq'> : never) : never;
