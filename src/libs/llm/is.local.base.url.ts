/** Verdadeiro para `localhost`, `127.0.0.1` e `[::1]` (servidores locais nao recebem `usage.include`). */
export function isLocalBaseUrl(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname;
    return host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host === '::1';
  } catch {
    return false;
  }
}
