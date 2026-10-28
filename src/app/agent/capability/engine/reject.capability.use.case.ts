import { type CapabilityRequest } from '../../../../domain/capability/capability.request.ts';
import { CapabilityNotFoundError } from '../../../../domain/capability/errors/capability.not.found.error.ts';
import { type CapabilityEngineDeps } from './engine.deps.ts';

/** Recusar um pedido pendente: nada e conectado, nenhuma credencial e guardada. Repetir nao muda nada. */
export async function rejectCapability(deps: CapabilityEngineDeps, input: { readonly userId: string; readonly requestId: string }): Promise<CapabilityRequest> {
  const request = await deps.stores.requests.get(input.userId, input.requestId);
  if (request === null) throw new CapabilityNotFoundError('pedido');
  if (request.status !== 'pending' && request.status !== 'failed') return request;
  const next: CapabilityRequest = { ...request, status: 'rejected', decidedAt: deps.clock.now().toISOString() };
  await deps.stores.requests.save(next);
  return next;
}

/** Marca como vencidos os pedidos pendentes passados da validade (24 h); devolve quantos. */
export async function expireRequests(deps: CapabilityEngineDeps, userId: string): Promise<number> {
  const now = deps.clock.now();
  const expired = await deps.stores.requests.listExpired(userId, now.toISOString());
  for (const request of expired) await deps.stores.requests.save({ ...request, status: 'expired', decidedAt: now.toISOString() });
  return expired.length;
}
