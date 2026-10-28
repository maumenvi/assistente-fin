import { type FolderGrant } from '../../../domain/agent/folder/folder.grant.ts';
import { type SecretStorePort } from '../ports/settings/secret.store.port.ts';
import { type FolderGrantStorePort } from './folder.grant.store.port.ts';

const refOf = (userId: string): string => `folder-grants:${userId}`;

/** Guarda as concessoes no cofre cifrado do agente (um JSON por usuario); com `MemorySecretStore` serve aos testes. */
export class SecretFolderGrantStore implements FolderGrantStorePort {
  private readonly secrets: SecretStorePort;

  public constructor(secrets: SecretStorePort) {
    this.secrets = secrets;
  }

  public async list(userId: string): Promise<readonly FolderGrant[]> {
    const raw = await this.secrets.get(refOf(userId));
    if (raw === null) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as FolderGrant[]).filter((g) => typeof g.path === 'string' && Array.isArray(g.access)) : [];
    } catch {
      return [];
    }
  }

  public async add(userId: string, grant: FolderGrant): Promise<void> {
    await this.secrets.set(refOf(userId), JSON.stringify([...(await this.list(userId)), grant]));
  }

  public async remove(userId: string, grantId: string): Promise<boolean> {
    const current = await this.list(userId);
    const next = current.filter((g) => g.id !== grantId);
    if (next.length === current.length) return false;
    await this.secrets.set(refOf(userId), JSON.stringify(next));
    return true;
  }
}
