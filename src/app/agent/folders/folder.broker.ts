import { FolderAccessDeniedError } from '../../../domain/agent/errors/folder.access.denied.error.ts';
import { assertPlainPath } from '../../../domain/agent/folder/assert.plain.path.ts';
import { type DenyContext, isDeniedPath } from '../../../domain/agent/folder/is.denied.path.ts';
import { type FileEditPreview } from '../../../domain/agent/folder/file.edit.preview.ts';
import { type FolderAccess } from '../../../domain/agent/folder/folder.access.ts';
import { type FolderGrant } from '../../../domain/agent/folder/folder.grant.ts';
import { resolveWithinGrant } from '../../../domain/agent/folder/resolve.within.grant.ts';
import { type Clock } from '../../shared/clock.port.ts';
import { type IdGenerator } from '../../shared/id.generator.port.ts';
import { type FileAccessPort } from '../ports/files/file.access.port.ts';
import { type FileGate } from '../ports/tool/file.gate.ts';
import { type FolderDecision } from './folder.decision.ts';
import { type FolderGrantStorePort } from './folder.grant.store.port.ts';
import { type GateScope } from './gate.scope.ts';
import { type PendingRequest } from './pending.request.ts';

export interface FolderBrokerDeps {
  readonly store: FolderGrantStorePort;
  readonly files: FileAccessPort;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly deny: DenyContext;
}

/** Nao existe pedido pendente com esse id (ja decidido, expirado ou de outro usuario). */
export class UnknownFileRequestError extends Error {
  public constructor() {
    super('pedido de permissao nao encontrado');
  }
}

/**
 * Concessoes de pasta e pedidos de permissao (spec 040, FR-010..012). Concessao nasce SO aqui, de uma decisao da pessoa
 * (`decide`, acionada pelo clique no cartao do chat); ferramenta e modelo nao tem como criar uma. Pedidos de conversas diferentes
 * sao independentes (`requestId`). `once` fica em memoria, por execucao.
 */
export class FolderBroker {
  private readonly deps: FolderBrokerDeps;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly onceByRun = new Map<string, FolderGrant[]>();

  public constructor(deps: FolderBrokerDeps) {
    this.deps = deps;
  }

  /** Porta de uma execucao: usada pelas ferramentas de arquivo. */
  public gateFor(scope: GateScope): FileGate {
    return {
      ensure: (path, access) => this.ensure(scope, path, access),
      confirmEdit: (path, preview) => this.confirmEdit(scope, path, preview),
      requestFolder: (access) => this.requestFolder(scope, access),
    };
  }

  /**
   * Adicao direta pela pessoa (botao "Adicionar pasta/arquivo", dialogo nativo): libera a pasta (ou um arquivo) em definitivo, sem esperar o assistente pedir.
   * `read` = so leitura; `write` = ler, criar e editar. Pasta proibida ou que nao e pasta e recusada; repetir a mesma pasta substitui.
   */
  public async addGrant(userId: string, path: string, mode: 'read' | 'write'): Promise<FolderGrant> {
    const real = await this.deps.files.realpath(assertPlainPath(path, this.deps.deny.home));
    if (isDeniedPath(real, this.deps.deny)) throw new FolderAccessDeniedError('forbidden');
    if (!(await this.deps.files.exists(real))) throw new FolderAccessDeniedError('forbidden');
    for (const old of await this.deps.store.list(userId)) if (old.path === real) await this.deps.store.remove(userId, old.id);
    const grant: FolderGrant = {
      id: this.deps.ids.next(),
      path: real,
      access: mode === 'read' ? ['read'] : ['read', 'create', 'edit'],
      scope: 'persistent',
      createdAt: this.deps.clock.now().toISOString(),
    };
    await this.deps.store.add(userId, grant);
    return grant;
  }

  public list(userId: string): Promise<readonly FolderGrant[]> {
    return this.deps.store.list(userId);
  }

  public revoke(userId: string, grantId: string): Promise<boolean> {
    return this.deps.store.remove(userId, grantId);
  }

  /** Pedidos de permissao e de edicao que esperam a pessoa numa conversa. */
  public pendingOf(userId: string, conversationId: string): readonly { readonly requestId: string; readonly kind: 'folder' | 'edit' }[] {
    return [...this.pending.values()].filter((p) => p.scope.userId === userId && p.scope.conversationId === conversationId).map((p) => ({ requestId: p.requestId, kind: p.kind }));
  }

  /** Decisao do cartao de permissao. `pickedPath` e a outra pasta escolhida pela pessoa ("Escolher outra pasta"). */
  public decide(userId: string, requestId: string, decision: FolderDecision, pickedPath: string | null = null): void {
    const request = this.pending.get(requestId);
    if (request === undefined || request.scope.userId !== userId || request.kind !== 'folder') throw new UnknownFileRequestError();
    request.settle(decision, pickedPath);
  }

  /** Decisao do cartao de edicao. */
  public decideEdit(userId: string, requestId: string, approve: boolean): void {
    const request = this.pending.get(requestId);
    if (request === undefined || request.scope.userId !== userId || request.kind !== 'edit') throw new UnknownFileRequestError();
    request.settle(approve);
  }

  /** A execucao terminou: as permissoes "so desta vez" expiram e pedidos sem resposta viram negados. */
  public releaseRun(runId: string): void {
    this.onceByRun.delete(runId);
    for (const request of [...this.pending.values()]) {
      if (request.scope.runId !== runId) continue;
      if (request.kind === 'folder') request.settle('deny', null);
      else request.settle(false);
    }
  }

  private async grantsFor(scope: GateScope): Promise<readonly FolderGrant[]> {
    return [...(await this.deps.store.list(scope.userId)), ...(this.onceByRun.get(scope.runId) ?? [])];
  }

  /** Cartao sem caminho: a pessoa escolhe a pasta no seletor; ela fica liberada em definitivo com o acesso pedido. */
  private async requestFolder(scope: GateScope, access: FolderAccess): Promise<string> {
    const answer = await this.askFolder(scope, '', access, true);
    if (answer.decision === 'deny' || answer.pickedPath === null) throw new FolderAccessDeniedError('denied');
    return (await this.addGrant(scope.userId, answer.pickedPath, access === 'read' ? 'read' : 'write')).path;
  }

  private async ensure(scope: GateScope, path: string, access: FolderAccess): Promise<string> {
    const real = await this.deps.files.realpath(assertPlainPath(path, this.deps.deny.home));
    if (isDeniedPath(real, this.deps.deny)) throw new FolderAccessDeniedError('forbidden');
    if (resolveWithinGrant(real, await this.grantsFor(scope), access) !== null) return real;
    const folder = (await this.deps.files.isDirectory(real)) ? real : real.slice(0, Math.max(1, real.lastIndexOf('/')));
    const answer = await this.askFolder(scope, folder, access, !(await this.deps.files.isDirectory(folder)));
    if (answer.decision === 'deny') throw new FolderAccessDeniedError('denied');
    // escolha no seletor ("Adicionar pasta/arquivo" do cartao): libera em definitivo, com leitura ou leitura e gravacao conforme o que o assistente precisa
    if (answer.decision === 'folder' && answer.pickedPath !== null) {
      const added = await this.addGrant(scope.userId, answer.pickedPath, access === 'read' ? 'read' : 'write');
      if (resolveWithinGrant(real, await this.grantsFor(scope), access) === null) throw new FolderAccessDeniedError('redirected', added.path);
      return real;
    }
    const granted = answer.pickedPath === null ? folder : await this.deps.files.realpath(answer.pickedPath);
    if (isDeniedPath(granted, this.deps.deny)) throw new FolderAccessDeniedError('forbidden');
    const grant: FolderGrant = {
      id: this.deps.ids.next(),
      path: granted,
      access: [access],
      scope: answer.decision === 'once' ? 'once' : 'persistent',
      createdAt: this.deps.clock.now().toISOString(),
    };
    if (grant.scope === 'once') this.onceByRun.set(scope.runId, [...(this.onceByRun.get(scope.runId) ?? []), grant]);
    else await this.deps.store.add(scope.userId, grant);
    // outra pasta escolhida que nao cobre o pedido: o agente e avisado e refaz o pedido nela
    if (resolveWithinGrant(real, await this.grantsFor(scope), access) === null) throw new FolderAccessDeniedError('redirected', granted);
    return real;
  }

  private askFolder(scope: GateScope, folder: string, access: FolderAccess, missing: boolean): Promise<{ decision: FolderDecision; pickedPath: string | null }> {
    const requestId = this.deps.ids.next();
    return this.wait<{ decision: FolderDecision; pickedPath: string | null }>(scope, requestId, { type: 'folder_permission_requested', requestId, path: folder, access, missing }, (resolve): PendingRequest => ({
      requestId,
      scope,
      kind: 'folder',
      folder,
      access,
      settle: (decision, pickedPath) => resolve({ decision, pickedPath }),
    }), { decision: 'deny', pickedPath: null }, (value) => value.decision !== 'deny');
  }

  private confirmEdit(scope: GateScope, path: string, preview: FileEditPreview): Promise<boolean> {
    const requestId = this.deps.ids.next();
    return this.wait<boolean>(scope, requestId, { type: 'file_edit_confirmation_requested', requestId, path, preview }, (resolve): PendingRequest => ({
      requestId,
      scope,
      kind: 'edit',
      settle: (approve) => resolve(approve),
    }), false, (value) => value);
  }

  /** Publica o pedido e espera a decisao; cancelar a execucao conta como negar. Sempre emite `file_request_resolved`. */
  private wait<T>(
    scope: GateScope,
    requestId: string,
    body: Parameters<GateScope['emit']>[0],
    make: (resolve: (value: T) => void) => PendingRequest,
    onAbort: T,
    allowed: (value: T) => boolean,
  ): Promise<T> {
    return new Promise<T>((resolve) => {
      let done = false;
      const waitStartedAt = this.deps.clock.now().getTime();
      const finish = (value: T): void => {
        if (done) return;
        done = true;
        if (scope.waited !== undefined) scope.waited.ms += this.deps.clock.now().getTime() - waitStartedAt;
        this.pending.delete(requestId);
        scope.signal?.removeEventListener('abort', abort);
        scope.emit({ type: 'file_request_resolved', requestId, outcome: allowed(value) ? 'allowed' : 'denied' });
        resolve(value);
      };
      const abort = (): void => finish(onAbort);
      this.pending.set(requestId, make(finish));
      if (scope.signal?.aborted === true) return abort();
      scope.signal?.addEventListener('abort', abort, { once: true });
      scope.emit(body);
    });
  }
}
