import { type CapabilityStorePort } from '../../app/agent/capability/ports/capability.store.port.ts';
import { type CapabilityStoresPort } from '../../app/agent/capability/ports/capability.stores.port.ts';
import { type RequestStorePort } from '../../app/agent/capability/ports/request.store.port.ts';
import { type SkillFileStorePort, type StoredSkillFile } from '../../app/agent/capability/ports/skill.file.store.port.ts';
import { type UseStorePort } from '../../app/agent/capability/ports/use.store.port.ts';
import { type Capability } from '../../domain/capability/capability.ts';
import { type CapabilityRequest } from '../../domain/capability/capability.request.ts';
import { type CapabilityStatus } from '../../domain/capability/capability.status.ts';
import { type CapabilityUse } from '../../domain/capability/capability.use.ts';

class FakeCapabilityStore implements CapabilityStorePort {
  public readonly rows = new Map<string, Capability>();

  public save(capability: Capability): Promise<void> {
    const clash = [...this.rows.values()].find((c) => c.userId === capability.userId && c.slug === capability.slug && c.id !== capability.id);
    if (clash) return Promise.reject(new Error(`slug ja usado: ${capability.slug}`));
    this.rows.set(capability.id, structuredClone(capability));
    return Promise.resolve();
  }

  public get(userId: string, id: string): Promise<Capability | null> {
    const found = this.rows.get(id);
    return Promise.resolve(found && found.userId === userId ? structuredClone(found) : null);
  }

  public getBySlug(userId: string, slug: string): Promise<Capability | null> {
    const found = [...this.rows.values()].find((c) => c.userId === userId && c.slug === slug);
    return Promise.resolve(found ? structuredClone(found) : null);
  }

  public list(userId: string, filter?: { readonly status?: readonly CapabilityStatus[] }): Promise<Capability[]> {
    const rows = [...this.rows.values()]
      .filter((c) => c.userId === userId && (filter?.status === undefined || filter.status.includes(c.status)))
      .sort((a, b) => (a.approvedAt === b.approvedAt ? a.id.localeCompare(b.id) : b.approvedAt.localeCompare(a.approvedAt)));
    return Promise.resolve(structuredClone(rows));
  }

  public delete(userId: string, id: string): Promise<void> {
    const found = this.rows.get(id);
    if (found && found.userId === userId) this.rows.delete(id);
    return Promise.resolve();
  }
}

class FakeRequestStore implements RequestStorePort {
  public readonly rows = new Map<string, CapabilityRequest>();

  public save(request: CapabilityRequest): Promise<void> {
    this.rows.set(request.id, structuredClone(request));
    return Promise.resolve();
  }

  public get(userId: string, id: string): Promise<CapabilityRequest | null> {
    const found = this.rows.get(id);
    return Promise.resolve(found && found.userId === userId ? structuredClone(found) : null);
  }

  public listPending(userId: string): Promise<CapabilityRequest[]> {
    const rows = [...this.rows.values()].filter((r) => r.userId === userId && r.status === 'pending').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return Promise.resolve(structuredClone(rows));
  }

  public listExpired(userId: string, now: string): Promise<CapabilityRequest[]> {
    return Promise.resolve(structuredClone([...this.rows.values()].filter((r) => r.userId === userId && r.status === 'pending' && r.expiresAt <= now)));
  }

  public deleteAll(userId: string): Promise<void> {
    for (const [id, r] of [...this.rows]) if (r.userId === userId) this.rows.delete(id);
    return Promise.resolve();
  }
}

class FakeUseStore implements UseStorePort {
  public rows: CapabilityUse[] = [];

  public append(use: CapabilityUse): Promise<void> {
    this.rows.push(structuredClone(use));
    return Promise.resolve();
  }

  public listByCapability(userId: string, capabilityId: string, options: { readonly limit: number; readonly before?: string }): Promise<CapabilityUse[]> {
    const rows = this.rows
      .filter((u) => u.userId === userId && u.capabilityId === capabilityId && (options.before === undefined || u.at < options.before))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, options.limit);
    return Promise.resolve(structuredClone(rows));
  }

  public prune(userId: string, before: string): Promise<void> {
    this.rows = this.rows.filter((u) => u.userId !== userId || u.at >= before);
    return Promise.resolve();
  }

  public deleteByCapability(userId: string, capabilityId: string): Promise<void> {
    this.rows = this.rows.filter((u) => !(u.userId === userId && u.capabilityId === capabilityId));
    return Promise.resolve();
  }

  public deleteAll(userId: string): Promise<void> {
    this.rows = this.rows.filter((u) => u.userId !== userId);
    return Promise.resolve();
  }
}

/** Ordem por unidade de codigo (igual em todos os adaptadores, sem depender da colação do banco). */
const byPath = (a: StoredSkillFile, b: StoredSkillFile): number => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

class FakeSkillFileStore implements SkillFileStorePort {
  public readonly rows = new Map<string, { userId: string; capabilityId: string; file: StoredSkillFile }>();

  public replaceAll(userId: string, capabilityId: string, files: readonly StoredSkillFile[]): Promise<void> {
    for (const [key, row] of [...this.rows]) if (row.userId === userId && row.capabilityId === capabilityId) this.rows.delete(key);
    for (const file of files) this.rows.set(`${userId}|${capabilityId}|${file.path}`, { userId, capabilityId, file: { ...file } });
    return Promise.resolve();
  }

  public list(userId: string, capabilityId: string): Promise<StoredSkillFile[]> {
    return Promise.resolve([...this.rows.values()].filter((r) => r.userId === userId && r.capabilityId === capabilityId).map((r) => ({ ...r.file })).sort(byPath));
  }

  public async get(userId: string, capabilityId: string, path: string): Promise<StoredSkillFile | null> {
    return (await this.list(userId, capabilityId)).find((f) => f.path === path) ?? null;
  }

  public deleteByCapability(userId: string, capabilityId: string): Promise<void> {
    return this.replaceAll(userId, capabilityId, []);
  }

  public deleteAll(userId: string): Promise<void> {
    for (const [key, row] of [...this.rows]) if (row.userId === userId) this.rows.delete(key);
    return Promise.resolve();
  }
}

/** Capacidades, pedidos, usos e arquivos de skill em memoria (testes e evals; spec 034). */
export class FakeCapabilityStores implements CapabilityStoresPort {
  public readonly capabilities = new FakeCapabilityStore();
  public readonly requests = new FakeRequestStore();
  public readonly uses = new FakeUseStore();
  public readonly skillFiles = new FakeSkillFileStore();

  public async deleteAll(userId: string): Promise<void> {
    for (const c of await this.capabilities.list(userId)) await this.capabilities.delete(userId, c.id);
    await this.requests.deleteAll(userId);
    await this.uses.deleteAll(userId);
    await this.skillFiles.deleteAll(userId);
  }
}
