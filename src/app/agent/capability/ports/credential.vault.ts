import { type SecretStorePort } from '../../ports/settings/secret.store.port.ts';

/** Referencia no cofre de uma credencial de capacidade: `agent.key.cap.<id>.<nome>` (o Android aceita `agent.key.*`). */
export function credentialRef(capabilityId: string, name: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(capabilityId) || !/^[A-Za-z0-9_-]+$/.test(name)) throw new Error('nome de credencial invalido');
  return `agent.key.cap.${capabilityId}.${name}`;
}

/**
 * Cofre das credenciais das capacidades (spec 034, FR-006) sobre o `SecretStorePort` da plataforma.
 * O valor so entra por `save` (formulario do app, nunca o chat) e so sai por `get`, na hora de montar o
 * cabecalho da chamada ao host fixado. `deleteAll` e a revogacao: apaga todas as referencias.
 */
export class CredentialVault {
  private readonly secrets: SecretStorePort;

  public constructor(secrets: SecretStorePort) {
    this.secrets = secrets;
  }

  /** Guarda os valores e devolve as referencias (a ordem das chaves). Falha no meio apaga o que ja gravou. */
  public async save(capabilityId: string, values: Readonly<Record<string, string>>): Promise<string[]> {
    const saved: string[] = [];
    try {
      for (const [name, value] of Object.entries(values)) {
        const ref = credentialRef(capabilityId, name);
        await this.secrets.set(ref, value);
        saved.push(ref);
      }
    } catch (error) {
      await this.deleteAll(saved);
      throw error;
    }
    return saved;
  }

  public async get(ref: string): Promise<string | null> {
    return await this.secrets.get(ref);
  }

  /** Valores atuais das referencias (para `redact.secrets`); ausentes ficam de fora. */
  public async valuesOf(refs: readonly string[]): Promise<string[]> {
    const out: string[] = [];
    for (const ref of refs) {
      const value = await this.secrets.get(ref);
      if (value !== null) out.push(value);
    }
    return out;
  }

  public async deleteAll(refs: readonly string[]): Promise<void> {
    for (const ref of refs) {
      try {
        await this.secrets.delete(ref);
      } catch {
        // apagar o resto vale mais que parar no primeiro erro
      }
    }
  }
}
