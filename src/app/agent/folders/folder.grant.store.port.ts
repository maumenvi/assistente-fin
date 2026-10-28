import { type FolderGrant } from '../../../domain/agent/folder/folder.grant.ts';

/** Pastas liberadas em definitivo, por usuario (spec 040). */
export interface FolderGrantStorePort {
  list(userId: string): Promise<readonly FolderGrant[]>;
  add(userId: string, grant: FolderGrant): Promise<void>;
  /** Devolve `false` quando nao havia essa concessao. */
  remove(userId: string, grantId: string): Promise<boolean>;
}
