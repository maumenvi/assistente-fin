import { type Candidate } from '../../../../domain/capability/candidate.ts';
import { type Capability } from '../../../../domain/capability/capability.ts';
import { REQUEST_VALIDITY_HOURS, type CapabilityRequest } from '../../../../domain/capability/capability.request.ts';
import { parseHttpUrl } from '../../../../domain/capability/url.host.ts';
import { sanitizeText } from '../../tools/shared/sanitize.text.ts';
import { MAX_CANDIDATES } from '../catalog/search.catalog.ts';
import { type CatalogFailure } from '../ports/catalog.port.ts';
import { type CapabilityEngineDeps } from './engine.deps.ts';

export const REASON_MAX_CHARS = 300;

export interface RequestCapabilityInput {
  readonly userId: string;
  readonly conversationId: string;
  readonly runId: string | null;
  readonly messageId: string | null;
  /** O que o agente procura (palavras-chave). */
  readonly query: string;
  /** Por que o agente quer isto; mostrado ao usuario como "informado pelo assistente". */
  readonly reason: string;
  /** Endereco de servidor MCP que o PROPRIO usuario colou no pedido (quem chama confere que esta no texto dele). */
  readonly customUrl?: string | undefined;
}

export type RequestCapabilityOutcome =
  | { readonly kind: 'requests'; readonly requests: readonly CapabilityRequest[] }
  | { readonly kind: 'already_active'; readonly capabilities: readonly Capability[] }
  | { readonly kind: 'none'; readonly failures: readonly CatalogFailure[] };

/** Candidato de um endereco colado pelo usuario: nao verificado, sem dados declarados (exige o passo extra). */
export function customCandidate(url: string): Candidate | null {
  const parsed = parseHttpUrl(url);
  if (parsed === null) return null;
  const slug = parsed.hostname.replace(/^www\./, '').split('.')[0]?.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 36) || 'servidor';
  return {
    kind: 'mcp', slug, name: parsed.hostname, publisher: parsed.hostname, description: 'Servidor informado por você.', origin: { source: 'custom', ref: url.trim(), url: url.trim() }, badge: 'unverified',
    endpointUrl: url.trim(), transport: 'streamable-http', declaredEgress: [], permissions: ['network', 'sends_user_text'], credentialSpec: [{ name: 'Authorization', label: 'Chave de acesso (se o servidor pedir)', secret: true, header: 'Authorization', optional: true }], platforms: ['desktop', 'android'],
  };
}

/** Resumo do conteudo de uma skill para o cartao (arquivos, tamanho e o comeco do SKILL.md); falha nao impede o pedido. */
async function withSkillPreviews(deps: CapabilityEngineDeps, candidates: readonly Candidate[]): Promise<Candidate[]> {
  return await Promise.all(
    candidates.map(async (candidate) => {
      if (candidate.kind !== 'skill' || deps.skills === undefined || candidate.skillPreview !== undefined) return candidate;
      try {
        const files = await deps.skills.download(candidate);
        const entry = files.find((f) => f.path === 'SKILL.md');
        return { ...candidate, skillPreview: { files: files.length, bytes: files.reduce((sum, f) => sum + f.bytes, 0), excerpt: sanitizeText(entry?.content ?? '', 240) } };
      } catch {
        return candidate;
      }
    }),
  );
}

function sameOrigin(a: Candidate['origin'], b: Candidate['origin']): boolean {
  return a.source === b.source && a.ref === b.ref;
}

/**
 * `find_capability` (spec 034, FR-001/FR-002): busca no catalogo e grava ATE 3 pedidos `pending` com o
 * `Candidate` da FONTE (nunca do modelo; so o motivo vem do modelo, curto e rotulado). Capacidade ja ativa
 * que serve reaproveita-se sem novo pedido; pedido pendente igual na mesma conversa nao se repete.
 */
export async function requestCapability(deps: CapabilityEngineDeps, input: RequestCapabilityInput): Promise<RequestCapabilityOutcome> {
  const custom = input.customUrl === undefined ? null : customCandidate(input.customUrl);
  const found = custom === null ? await deps.catalog.search({ query: input.query, platform: deps.platform }) : { candidates: [custom], failures: [] as CatalogFailure[] };
  const candidates = await withSkillPreviews(deps, found.candidates.slice(0, MAX_CANDIDATES));
  if (candidates.length === 0) return { kind: 'none', failures: found.failures };

  const active = await deps.stores.capabilities.list(input.userId, { status: ['active'] });
  const reusable = candidates.flatMap((c) => active.filter((a) => sameOrigin(a.origin, c.origin)));
  if (reusable.length > 0) return { kind: 'already_active', capabilities: reusable };

  const pending = await deps.stores.requests.listPending(input.userId);
  const now = deps.clock.now();
  const reason = sanitizeText(input.reason, REASON_MAX_CHARS);
  const requests: CapabilityRequest[] = [];
  for (const candidate of candidates) {
    const same = pending.find((p) => p.conversationId === input.conversationId && sameOrigin(p.candidate.origin, candidate.origin) && Date.parse(p.expiresAt) > now.getTime());
    if (same !== undefined) {
      requests.push(same);
      continue;
    }
    const request: CapabilityRequest = {
      id: deps.ids.next(), userId: input.userId, conversationId: input.conversationId, runId: input.runId, messageId: input.messageId, status: 'pending', candidate, reason,
      replacesCapabilityId: null, diff: null, createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + REQUEST_VALIDITY_HOURS * 3_600_000).toISOString(), decidedAt: null, lastError: null,
    };
    await deps.stores.requests.save(request);
    requests.push(request);
  }
  return { kind: 'requests', requests };
}
