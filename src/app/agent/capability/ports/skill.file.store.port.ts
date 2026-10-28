/** Arquivo de texto de uma skill instalada. */
export interface StoredSkillFile {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly content: string;
}

/** Arquivos das skills (texto UTF-8) no banco do aparelho. */
export interface SkillFileStorePort {
  /** Troca TODOS os arquivos da skill. */
  replaceAll(userId: string, capabilityId: string, files: readonly StoredSkillFile[]): Promise<void>;
  list(userId: string, capabilityId: string): Promise<StoredSkillFile[]>;
  get(userId: string, capabilityId: string, path: string): Promise<StoredSkillFile | null>;
  deleteByCapability(userId: string, capabilityId: string): Promise<void>;
  deleteAll(userId: string): Promise<void>;
}
