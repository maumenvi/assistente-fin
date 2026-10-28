import { type MessagePart } from '../../../../domain/agent/message.part.ts';

/** Cartoes dos pedidos de capacidade criados na execucao, na ordem em que nasceram. */
export function capabilityRequestParts(requestIds: readonly string[]): MessagePart[] {
  return requestIds.map((requestId) => ({ type: 'capability_request' as const, requestId }));
}
