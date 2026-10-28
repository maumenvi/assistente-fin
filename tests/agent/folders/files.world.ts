import { FileTooLargeError } from '../../../src/domain/agent/errors/file.too.large.error.ts';
import { FolderBroker } from '../../../src/app/agent/folders/folder.broker.ts';
import { type FolderDecision } from '../../../src/app/agent/folders/folder.decision.ts';
import { SecretFolderGrantStore } from '../../../src/app/agent/folders/secret.folder.grant.store.ts';
import { type AgentEvent } from '../../../src/app/agent/ports/events/agent.event.ts';
import { type AgentEventBody } from '../../../src/app/agent/ports/events/agent.event.body.ts';
import { type FileAccessPort, type FileEntry, type SearchFilesOptions } from '../../../src/app/agent/ports/files/file.access.port.ts';
import { type GitProbePort } from '../../../src/app/agent/ports/files/git.probe.port.ts';
import { type ToolContext } from '../../../src/app/agent/ports/tool/tool.context.ts';
import { MemorySecretStore } from '../../../src/app/agent/settings/memory.secret.store.ts';
import { buildFileTools, createFileToolRegistry } from '../../../src/app/agent/tools/files/file.tool.registry.ts';
import { RegistryToolPort } from '../../../src/app/agent/tools/registry.tool.port.ts';
import { FixedClock } from '../../support/fixed.clock.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

/** Disco em memoria: arquivos, pastas e links simbolicos (prefixo -> destino). */
export class MemoryFileAccess implements FileAccessPort {
  public readonly files = new Map<string, string>();
  public readonly dirs = new Set<string>(['/']);
  public readonly links = new Map<string, string>();
  public reads = 0;

  public addFile(path: string, content: string): void {
    this.files.set(path, content);
    for (let dir = path.slice(0, path.lastIndexOf('/')); dir !== ''; dir = dir.slice(0, dir.lastIndexOf('/'))) this.dirs.add(dir);
  }

  public realpath(path: string): Promise<string> {
    for (const [from, to] of this.links) if (path === from || path.startsWith(`${from}/`)) return Promise.resolve(to + path.slice(from.length));
    return Promise.resolve(path);
  }

  public isDirectory(path: string): Promise<boolean> {
    return Promise.resolve(this.dirs.has(path));
  }

  public exists(path: string): Promise<boolean> {
    return Promise.resolve(this.dirs.has(path) || this.files.has(path));
  }

  public search(root: string, options: SearchFilesOptions): Promise<{ entries: FileEntry[]; truncated: boolean }> {
    const needle = options.query?.toLowerCase();
    const all = [...this.files.entries()]
      .filter(([path]) => path.startsWith(`${root}/`) && (needle === undefined || path.toLowerCase().includes(needle)))
      .map(([path, content]) => ({ path, size: content.length, modifiedAt: '2026-10-27T00:00:00.000Z' }));
    return Promise.resolve({ entries: all.slice(0, options.maxResults), truncated: all.length > options.maxResults });
  }

  public read(path: string, maxBytes: number): Promise<Uint8Array> {
    this.reads += 1;
    const content = this.files.get(path);
    if (content === undefined) return Promise.reject(Object.assign(new Error('nao existe'), { code: 'ENOENT' }));
    const bytes = new TextEncoder().encode(content);
    if (bytes.length > maxBytes) return Promise.reject(new FileTooLargeError(maxBytes));
    return Promise.resolve(bytes);
  }

  public create(path: string, content: string): Promise<string> {
    const dot = path.lastIndexOf('.');
    const stem = dot > path.lastIndexOf('/') ? path.slice(0, dot) : path;
    const ext = dot > path.lastIndexOf('/') ? path.slice(dot) : '';
    let target = path;
    for (let n = 2; this.files.has(target); n += 1) target = `${stem}-${n}${ext}`;
    this.addFile(target, content);
    return Promise.resolve(target);
  }

  public write(path: string, content: string): Promise<void> {
    if (!this.files.has(path)) return Promise.reject(Object.assign(new Error('nao existe'), { code: 'ENOENT' }));
    this.files.set(path, content);
    return Promise.resolve();
  }
}

export class FakeGit implements GitProbePort {
  public inside = false;
  public isInsideRepo(): Promise<boolean> {
    return Promise.resolve(this.inside);
  }
}

export const DENY = { home: '/home/ana', userData: '/home/ana/.config/finance-controller' };

export interface FilesWorld {
  readonly disk: MemoryFileAccess;
  readonly git: FakeGit;
  readonly broker: FolderBroker;
  readonly secrets: MemorySecretStore;
  readonly events: AgentEvent[];
  readonly tools: RegistryToolPort;
  /** Escopo de uma execucao; `decide` responde automaticamente ao pedido (ou deixa pendente se `undefined`). */
  scope(options?: { userId?: string; conversationId?: string; runId?: string; decide?: FolderDecision | undefined; approveEdit?: boolean | undefined; signal?: AbortSignal; waited?: { ms: number } }): ToolContext;
}

/** Mundo de teste das ferramentas de arquivo: disco/git falsos, cofre em memoria e broker real. */
export function createFilesWorld(): FilesWorld {
  const disk = new MemoryFileAccess();
  const git = new FakeGit();
  const secrets = new MemorySecretStore();
  const broker = new FolderBroker({ store: new SecretFolderGrantStore(secrets), files: disk, ids: new SequentialIdGenerator('req'), clock: new FixedClock(new Date('2026-10-27T12:00:00Z')), deny: DENY });
  const events: AgentEvent[] = [];
  const tools = new RegistryToolPort(createFileToolRegistry(buildFileTools({ files: disk, git })), { timeoutMs: 5000 });
  let seq = 0;
  return {
    disk,
    git,
    broker,
    secrets,
    events,
    tools,
    scope: (options = {}) => {
      const userId = options.userId ?? 'u1';
      const conversationId = options.conversationId ?? 'c1';
      const runId = options.runId ?? 'r1';
      const emit = (body: AgentEventBody): void => {
        seq += 1;
        const event = { ...body, runId, conversationId, seq } as AgentEvent;
        events.push(event);
        // responde sozinho, como se a pessoa clicasse no cartao
        queueMicrotask(() => {
          if (event.type === 'folder_permission_requested' && options.decide !== undefined) broker.decide(userId, event.requestId, options.decide);
          if (event.type === 'file_edit_confirmation_requested' && options.approveEdit !== undefined) broker.decideEdit(userId, event.requestId, options.approveEdit);
        });
      };
      return {
        userId,
        now: new Date('2026-10-27T12:00:00Z'),
        locale: 'pt-BR',
        limits: { maxItems: 10, maxChars: 6000, timeoutMs: 5000 },
        files: broker.gateFor({ userId, conversationId, runId, emit, signal: options.signal, waited: options.waited }),
      };
    },
  };
}
