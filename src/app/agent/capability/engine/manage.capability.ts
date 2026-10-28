import { type Capability } from '../../../../domain/capability/capability.ts';
import { CapabilityNotFoundError } from '../../../../domain/capability/errors/capability.not.found.error.ts';
import { pauseCapability } from '../../../../domain/capability/lifecycle/pause.capability.ts';
import { resumeCapability } from '../../../../domain/capability/lifecycle/resume.capability.ts';
import { revokeCapability } from '../../../../domain/capability/lifecycle/revoke.capability.ts';
import { type CapabilityRuntime } from './capability.runtime.ts';
import { type CapabilityEngineDeps } from './engine.deps.ts';

async function load(deps: CapabilityEngineDeps, userId: string, id: string): Promise<Capability> {
  const capability = await deps.stores.capabilities.get(userId, id);
  if (capability === null) throw new CapabilityNotFoundError();
  return capability;
}

/** Pausa: o agente deixa de usar; a sessao e fechada, a configuracao fica. */
export async function pause(deps: CapabilityEngineDeps, runtime: CapabilityRuntime, userId: string, id: string): Promise<Capability> {
  const capability = await load(deps, userId, id);
  if (capability.status === 'paused') return capability;
  const next = pauseCapability(capability, deps.clock.now());
  await deps.stores.capabilities.save(next);
  await runtime.release(id);
  return next;
}

export type ResumeOutcome = { readonly capability: Capability; readonly requestId: string | null };

/**
 * Retoma e REVERIFICA a identidade (servidor MCP): se mudou, volta a `needs_review` com pedido de reaprovacao.
 * Servidor fora do ar nao impede retomar (a verificacao se repete no primeiro uso). Skill: confere o hash dos arquivos.
 */
export async function resume(deps: CapabilityEngineDeps, runtime: CapabilityRuntime, userId: string, id: string): Promise<ResumeOutcome> {
  const capability = await load(deps, userId, id);
  if (capability.status === 'active') return { capability, requestId: null };
  const active = resumeCapability(capability, deps.clock.now());
  await deps.stores.capabilities.save(active);
  await runtime.release(id);
  if (active.kind !== 'mcp') return { capability: active, requestId: null };
  const acquired = await runtime.acquire(active, { conversationId: '', runId: null, messageId: null });
  if (acquired.status === 'changed') return { capability: (await deps.stores.capabilities.get(userId, id)) ?? active, requestId: acquired.requestId };
  return { capability: active, requestId: null };
}

/**
 * Revoga (terminal, SC-009): apaga credenciais e arquivos de skill, fecha a sessao e cancela pedidos de reaprovacao. Depois disto
 * nenhuma chamada e possivel (a capacidade nao esta mais `active` e o cofre esta vazio).
 */
export async function revoke(deps: CapabilityEngineDeps, runtime: CapabilityRuntime, userId: string, id: string): Promise<Capability> {
  const capability = await load(deps, userId, id);
  if (capability.status === 'revoked') return capability;
  const next = revokeCapability(capability, deps.clock.now());
  await deps.stores.capabilities.save(next);
  await runtime.release(id);
  await deps.vault.deleteAll(capability.credentialRefs);
  await deps.stores.skillFiles.deleteByCapability(userId, id);
  const now = deps.clock.now().toISOString();
  for (const request of await deps.stores.requests.listPending(userId)) {
    if (request.replacesCapabilityId === id) await deps.stores.requests.save({ ...request, status: 'superseded', decidedAt: now });
  }
  return next;
}
