import { type SecretStorePort } from '../ports/settings/secret.store.port.ts';

/** Cofre de segredos em memoria (testes e avaliacoes). */
export class MemorySecretStore implements SecretStorePort {
  private readonly secrets = new Map<string, string>();

  public get(ref: string): Promise<string | null> {
    return Promise.resolve(this.secrets.get(ref) ?? null);
  }

  public set(ref: string, secret: string): Promise<void> {
    this.secrets.set(ref, secret);
    return Promise.resolve();
  }

  public delete(ref: string): Promise<void> {
    this.secrets.delete(ref);
    return Promise.resolve();
  }

  /** So para testes: quais referencias existem. */
  public refs(): string[] {
    return [...this.secrets.keys()];
  }
}
