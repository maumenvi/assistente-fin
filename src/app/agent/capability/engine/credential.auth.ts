import { type McpAuth } from '../ports/mcp.client.port.ts';
import { type CredentialVault } from '../ports/credential.vault.ts';

/** Nome do cabecalho = ultimo trecho da referencia `agent.key.cap.<id>.<Cabecalho>`. */
export function headerOfRef(ref: string): string {
  return ref.split('.').slice(4).join('.');
}

/**
 * Monta os cabecalhos de credencial a partir do cofre. `Authorization` sem esquema vira `Bearer <valor>`.
 * Referencia sem valor no cofre e ignorada (o servidor responde 401 e o erro volta com motivo claro).
 */
export async function buildAuth(vault: CredentialVault, refs: readonly string[]): Promise<McpAuth> {
  const headers: Record<string, string> = {};
  for (const ref of refs) {
    const value = await vault.get(ref);
    if (value === null || value === '') continue;
    const header = headerOfRef(ref);
    headers[header] = header.toLowerCase() === 'authorization' && !/\s/.test(value) ? `Bearer ${value}` : value;
  }
  return { headers };
}
