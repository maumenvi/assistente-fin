import { REQUEST_VALIDITY_HOURS, type CapabilityRequest, type RequestDiff } from '../../../../domain/capability/capability.request.ts';
import { type Capability } from '../../../../domain/capability/capability.ts';
import { diffIdentity } from '../../../../domain/capability/lifecycle/diff.identity.ts';
import { fingerprintIdentity } from '../../../../domain/capability/lifecycle/fingerprint.identity.ts';
import { markNeedsReview } from '../../../../domain/capability/lifecycle/mark.needs.review.ts';
import { type McpConnection, type McpTool } from '../ports/mcp.client.port.ts';
import { candidateOf } from './candidate.of.ts';
import { buildAuth } from './credential.auth.ts';
import { describeError } from './describe.error.ts';
import { type CapabilityEngineDeps } from './engine.deps.ts';

export interface RunSource {
  readonly conversationId: string;
  readonly runId: string | null;
  readonly messageId: string | null;
}

export type Acquired =
  | { readonly status: 'ok'; readonly connection: McpConnection; readonly tools: readonly McpTool[] }
  | { readonly status: 'changed'; readonly diff: RequestDiff; readonly requestId: string }
  | { readonly status: 'unavailable'; readonly reason: string };

interface Session {
  readonly connection: McpConnection;
  readonly tools: readonly McpTool[];
}

/**
 * Sessoes MCP das capacidades ativas (spec 034, FR-007/FR-008): conecta sob demanda e, no PRIMEIRO uso da sessao do
 * app (e a cada reconexao), refaz `tools/list` e compara com a identidade fixada. Mudou -> a capacidade vai a
 * `needs_review`, nasce um novo pedido com o `diff` e a chamada e recusada (`changed`). Servidor fora do ar
 * -> `unavailable`, sem derrubar o resto. A conexao so existe aqui; revogar/pausar a fecha na hora.
 */
export class CapabilityRuntime {
  private readonly deps: CapabilityEngineDeps;
  private readonly sessions = new Map<string, Promise<Acquired>>();
  private readonly open = new Map<string, Session>();

  public constructor(deps: CapabilityEngineDeps) {
    this.deps = deps;
  }

  public acquire(capability: Capability, source: RunSource): Promise<Acquired> {
    const existing = this.sessions.get(capability.id);
    if (existing !== undefined) return existing;
    const attempt = this.connectAndVerify(capability, source).then((outcome) => {
      if (outcome.status !== 'ok') this.sessions.delete(capability.id);
      return outcome;
    });
    this.sessions.set(capability.id, attempt);
    return attempt;
  }

  /** Fecha a sessao (revogar, pausar, trocar de usuario). Nunca lanca. */
  public async release(capabilityId: string): Promise<void> {
    this.sessions.delete(capabilityId);
    const session = this.open.get(capabilityId);
    this.open.delete(capabilityId);
    if (session !== undefined) await this.deps.mcp.close(session.connection).catch(() => undefined);
  }

  /** Esquece a sessao sem fechar (a conexao caiu): a proxima chamada reconecta e reverifica. */
  public forget(capabilityId: string): void {
    this.sessions.delete(capabilityId);
    this.open.delete(capabilityId);
  }

  public async releaseAll(): Promise<void> {
    await Promise.all([...this.open.keys()].map((id) => this.release(id)));
  }

  private async connectAndVerify(capability: Capability, source: RunSource): Promise<Acquired> {
    const endpoint = capability.endpoint;
    if (endpoint === undefined) return { status: 'unavailable', reason: 'a capacidade nao tem endereco' };
    const auth = await buildAuth(this.deps.vault, capability.credentialRefs);
    let connection: McpConnection;
    try {
      connection = await this.deps.mcp.connect({ url: endpoint.url, allowInsecureLocal: this.deps.allowInsecureLocal() }, auth);
    } catch (error) {
      return { status: 'unavailable', reason: describeError(error, Object.values(auth.headers)) };
    }
    try {
      const tools = await this.deps.mcp.listTools(connection);
      const current = fingerprintIdentity(connection.serverInfo.name, connection.serverInfo.version, tools, this.deps.sha256, this.deps.clock.now());
      if (current.hash !== capability.identity.hash) {
        const diff = diffIdentity(capability.identity, current);
        await this.deps.mcp.close(connection).catch(() => undefined);
        return { status: 'changed', diff, requestId: await this.flagChanged(capability, diff, source) };
      }
      this.open.set(capability.id, { connection, tools });
      return { status: 'ok', connection, tools };
    } catch (error) {
      await this.deps.mcp.close(connection).catch(() => undefined);
      return { status: 'unavailable', reason: describeError(error, Object.values(auth.headers)) };
    }
  }

  /** `needs_review` + pedido de reaprovacao com o diff (um so pedido pendente por capacidade). */
  private async flagChanged(capability: Capability, diff: RequestDiff, source: RunSource): Promise<string> {
    const now = this.deps.clock.now();
    const flagged = capability.status === 'needs_review' ? capability : markNeedsReview(capability, now);
    if (flagged !== capability) await this.deps.stores.capabilities.save(flagged);
    const pending = (await this.deps.stores.requests.listPending(capability.userId)).find((r) => r.replacesCapabilityId === capability.id);
    if (pending !== undefined) return pending.id;
    const request: CapabilityRequest = {
      id: this.deps.ids.next(), userId: capability.userId, conversationId: source.conversationId, runId: source.runId, messageId: source.messageId, status: 'pending',
      candidate: candidateOf(capability, this.deps.platform), reason: '', replacesCapabilityId: capability.id, diff, createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + REQUEST_VALIDITY_HOURS * 3_600_000).toISOString(), decidedAt: null, lastError: null,
    };
    await this.deps.stores.requests.save(request);
    return request.id;
  }
}
