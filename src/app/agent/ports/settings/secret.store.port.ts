/** Cofre de segredos da plataforma (arquivo cifrado no desktop, `expo-secure-store` no Android). */
export interface SecretStorePort {
  get(ref: string): Promise<string | null>;
  set(ref: string, secret: string): Promise<void>;
  delete(ref: string): Promise<void>;
}
