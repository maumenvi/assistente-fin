import { type Capability } from '../../../domain/capability/capability.ts';
import { type CapabilityRequest } from '../../../domain/capability/capability.request.ts';
import { CapabilityNotFoundError } from '../../../domain/capability/errors/capability.not.found.error.ts';
import { headerOfRef } from './engine/credential.auth.ts';
import { type CapabilityUse } from '../../../domain/capability/capability.use.ts';
import { CapabilityUnavailableError } from '../../../domain/capability/errors/capability.unavailable.error.ts';
import { type AnyAgentTool } from '../tools/agent.tool.ts';
import { approveCapability, type ApproveCapabilityInput, type ApproveOutcome } from './engine/approve.capability.use.case.ts';
import { CapabilityRuntime } from './engine/capability.runtime.ts';
import { type CapabilityEngineDeps } from './engine/engine.deps.ts';
import { requestCapability, type RequestCapabilityInput, type RequestCapabilityOutcome } from './engine/request.capability.ts';
import { pause, resume, revoke, type ResumeOutcome } from './engine/manage.capability.ts';
import { expireRequests, rejectCapability } from './engine/reject.capability.use.case.ts';
import { renderCapabilityIndex } from './prompt/render.capability.index.ts';
import { buildCapabilityTools } from './tools/build.capability.tools.ts';
import { type CapabilityToolDeps } from './tools/capability.tool.deps.ts';

/**
 * Fachada das capacidades dinamicas (spec 034) para as bordas e para o agente: listar, aprovar, recusar, pausar,
 * retomar, revogar, historico e o indice do prompt. Sem fiacao (`engine === null`, testes que nao usam capacidades)
 * as operacoes lancam `CapabilityUnavailableError` e o agente nao recebe as meta-ferramentas.
 */
export class CapabilityService {
  private readonly engine: CapabilityEngineDeps | null;
  private readonly runtime: CapabilityRuntime | null;

  private readonly recentUserText: CapabilityToolDeps['recentUserText'];

  public constructor(engine: CapabilityEngineDeps | null, recentUserText?: CapabilityToolDeps['recentUserText']) {
    this.engine = engine;
    this.recentUserText = recentUserText;
    this.runtime = engine === null ? null : new CapabilityRuntime(engine);
  }

  public get wired(): boolean {
    return this.engine !== null;
  }

  /** As 4 meta-ferramentas, ou nenhuma quando nao ha fiacao. */
  public tools(): AnyAgentTool[] {
    return this.engine === null || this.runtime === null ? [] : buildCapabilityTools({ engine: this.engine, runtime: this.runtime, recentUserText: this.recentUserText });
  }

  /** Bloco do prompt (vazio sem fiacao). */
  public async index(userId: string): Promise<string> {
    if (this.engine === null) return '';
    return renderCapabilityIndex(await this.engine.stores.capabilities.list(userId, { status: ['active'] }));
  }

  public async list(userId: string): Promise<Capability[]> {
    return await this.need().engine.stores.capabilities.list(userId);
  }

  public async listPending(userId: string): Promise<CapabilityRequest[]> {
    return await this.need().engine.stores.requests.listPending(userId);
  }

  public async getRequest(userId: string, id: string): Promise<CapabilityRequest | null> {
    return await this.need().engine.stores.requests.get(userId, id);
  }

  /** Busca no catalogo e grava os pedidos pendentes (o mesmo caminho de `find_capability`; nada e conectado). */
  public async request(input: RequestCapabilityInput): Promise<RequestCapabilityOutcome> {
    return await requestCapability(this.need().engine, input);
  }

  public async approve(input: ApproveCapabilityInput): Promise<ApproveOutcome> {
    const { engine, runtime } = this.need();
    const outcome = await approveCapability(engine, input);
    if (outcome.status === 'active') await runtime.release(outcome.capability.id);
    return outcome;
  }

  public async reject(userId: string, requestId: string): Promise<CapabilityRequest> {
    return await rejectCapability(this.need().engine, { userId, requestId });
  }

  public async pause(userId: string, id: string): Promise<Capability> {
    const { engine, runtime } = this.need();
    return await pause(engine, runtime, userId, id);
  }

  public async resume(userId: string, id: string): Promise<ResumeOutcome> {
    const { engine, runtime } = this.need();
    return await resume(engine, runtime, userId, id);
  }

  public async revoke(userId: string, id: string): Promise<Capability> {
    const { engine, runtime } = this.need();
    return await revoke(engine, runtime, userId, id);
  }

  /** Troca o valor de uma credencial que a capacidade ja usa (o valor vem do formulario do app, nunca do chat). */
  public async setCredential(userId: string, capabilityId: string, name: string, value: string): Promise<void> {
    const { engine, runtime } = this.need();
    const capability = await engine.stores.capabilities.get(userId, capabilityId);
    if (capability === null || capability.status === 'revoked') throw new CapabilityNotFoundError();
    if (!capability.credentialRefs.some((ref) => headerOfRef(ref) === name)) throw new CapabilityNotFoundError(`credencial ${name}`);
    await engine.vault.save(capabilityId, { [name]: value });
    await runtime.release(capabilityId);
  }

  public async history(userId: string, capabilityId: string, options: { readonly limit: number; readonly before?: string }): Promise<CapabilityUse[]> {
    return await this.need().engine.stores.uses.listByCapability(userId, capabilityId, options);
  }

  /** Marca como vencidos os pedidos passados de 24 h (roda depois de cada resposta). */
  public async expire(userId: string): Promise<number> {
    return this.engine === null ? 0 : await expireRequests(this.engine, userId);
  }

  /** "Apagar tudo" do usuario: revoga cada capacidade (credenciais e sessoes) e limpa o armazenamento. */
  public async deleteAll(userId: string): Promise<void> {
    if (this.engine === null || this.runtime === null) return;
    for (const capability of await this.engine.stores.capabilities.list(userId)) await revoke(this.engine, this.runtime, userId, capability.id).catch(() => undefined);
    await this.engine.stores.deleteAll(userId);
  }

  /** Encerra as sessoes abertas (fim da sessao do app ou troca de usuario). */
  public async closeAll(): Promise<void> {
    await this.runtime?.releaseAll();
  }

  private need(): { engine: CapabilityEngineDeps; runtime: CapabilityRuntime } {
    if (this.engine === null || this.runtime === null) throw new CapabilityUnavailableError('as capacidades nao estao disponiveis neste aparelho');
    return { engine: this.engine, runtime: this.runtime };
  }
}
