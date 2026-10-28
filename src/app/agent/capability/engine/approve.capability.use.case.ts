import { type Candidate } from '../../../../domain/capability/candidate.ts';
import { type Capability } from '../../../../domain/capability/capability.ts';
import { type CapabilityRequest } from '../../../../domain/capability/capability.request.ts';
import { CapabilityNotApprovedError } from '../../../../domain/capability/errors/capability.not.approved.error.ts';
import { CapabilityNotFoundError } from '../../../../domain/capability/errors/capability.not.found.error.ts';
import { CapabilityPlatformUnsupportedError } from '../../../../domain/capability/errors/capability.platform.unsupported.error.ts';
import { CapabilityRequestExpiredError } from '../../../../domain/capability/errors/capability.request.expired.error.ts';
import { connectAndPin } from './connect.and.pin.ts';
import { type CapabilityEngineDeps } from './engine.deps.ts';
import { installSkill } from './install.skill.ts';
import { freeSlug } from './slug.ts';

export interface ApproveCapabilityInput {
  readonly userId: string;
  readonly requestId: string;
  /** Valores do formulario do app, por nome de credencial. */
  readonly credentials?: Readonly<Record<string, string>> | undefined;
  /** Passo extra de fonte nao verificada: tem de ser igual ao nome do publicador. */
  readonly confirmUntrusted?: string | undefined;
}

export type ApproveOutcome =
  | { readonly status: 'active'; readonly capability: Capability; readonly request: CapabilityRequest }
  | { readonly status: 'needs_confirmation'; readonly request: CapabilityRequest }
  | { readonly status: 'failed'; readonly request: CapabilityRequest; readonly reason: string };

/** Candidato que exige o passo extra: fonte nao verificada ou que nao declara os dados enviados. */
export function needsExtraConfirmation(candidate: Candidate): boolean {
  return candidate.badge === 'unverified' || candidate.declaredEgress.length === 0;
}

/** Defesa em profundidade: Android nao roda codigo local (a busca ja filtra; aqui e conferido de novo). */
function supportedHere(candidate: Candidate, platform: CapabilityEngineDeps['platform']): boolean {
  if (!candidate.platforms.includes(platform)) return false;
  if (candidate.kind === 'skill') return true;
  return candidate.transport === 'streamable-http' || candidate.transport === 'sse';
}

async function close(deps: CapabilityEngineDeps, request: CapabilityRequest, patch: Partial<CapabilityRequest>): Promise<CapabilityRequest> {
  const next = { ...request, ...patch };
  await deps.stores.requests.save(next);
  return next;
}

/**
 * Aprovar (ordem de contracts/capability.lifecycle.md): validade -> passo extra -> plataforma -> conectar/instalar e
 * fixar -> capacidade `active`. So a UI chama isto (`agent:capabilities.approve`): nao existe ferramenta do
 * agente nem chave de autonomia que o faca. Idempotente: pedido ja aprovado devolve a mesma capacidade.
 */
export async function approveCapability(deps: CapabilityEngineDeps, input: ApproveCapabilityInput): Promise<ApproveOutcome> {
  const request = await deps.stores.requests.get(input.userId, input.requestId);
  if (request === null) throw new CapabilityNotFoundError('pedido');
  if (request.status === 'approved') {
    const done = await deps.stores.capabilities.getBySlug(input.userId, request.candidate.slug);
    const active = done ?? (await deps.stores.capabilities.list(input.userId)).find((c) => c.origin.source === request.candidate.origin.source && c.origin.ref === request.candidate.origin.ref);
    if (active !== undefined && active !== null) return { status: 'active', capability: active, request };
  }
  const now = deps.clock.now();
  if (request.status === 'expired' || (request.status === 'pending' && Date.parse(request.expiresAt) <= now.getTime())) {
    if (request.status === 'pending') await close(deps, request, { status: 'expired', decidedAt: now.toISOString() });
    throw new CapabilityRequestExpiredError();
  }
  if (request.status !== 'pending' && request.status !== 'failed') throw new CapabilityNotApprovedError(`o pedido esta ${request.status}`);

  const { candidate } = request;
  if (needsExtraConfirmation(candidate) && (input.confirmUntrusted ?? '').trim() !== candidate.publisher.trim()) throw new CapabilityNotApprovedError('confirme digitando o nome do publicador');
  if (!supportedHere(candidate, deps.platform)) throw new CapabilityPlatformUnsupportedError(candidate.name);

  const existing = request.replacesCapabilityId === null ? null : await deps.stores.capabilities.get(input.userId, request.replacesCapabilityId);
  const slug = existing?.slug ?? (await freeSlug(deps, input.userId, candidate.slug));
  const capabilityId = existing?.id ?? deps.ids.next();
  const usable: Candidate = { ...candidate, slug };
  const outcome =
    candidate.kind === 'skill'
      ? await installSkill(deps, { userId: input.userId, capabilityId, candidate: usable, existing })
      : await connectAndPin(deps, { userId: input.userId, capabilityId, candidate: usable, credentials: input.credentials ?? {}, acknowledgeExtra: request.diff !== null && request.diff.extraInputs.length > 0, existing });

  if (outcome.status === 'needs_confirmation') return { status: 'needs_confirmation', request: await close(deps, request, { status: 'pending', diff: outcome.diff, lastError: null }) };
  if (outcome.status === 'failed') return { status: 'failed', reason: outcome.reason, request: await close(deps, request, { status: 'failed', lastError: outcome.reason, decidedAt: now.toISOString() }) };
  await deps.stores.capabilities.save(outcome.capability);
  return { status: 'active', capability: outcome.capability, request: await close(deps, request, { status: 'approved', decidedAt: now.toISOString(), lastError: null }) };
}
