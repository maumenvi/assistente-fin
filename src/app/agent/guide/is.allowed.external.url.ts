/**
 * Um endereco pode abrir no navegador externo? (spec 035, FR-007) So `https:`, sem usuario/senha e com o host
 * (ou subdominio dele) na lista. Funcao pura, usada pelo desktop (`shell.openExternal`) e pelo Android (`Linking`).
 */
export function isAllowedExternalUrl(url: string, allowedHosts: readonly string[]): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (parsed.username !== '' || parsed.password !== '') return false;
  const host = parsed.hostname.toLowerCase();
  return allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}
