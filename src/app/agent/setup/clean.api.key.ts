/** Chave colada: tira espacos, quebras de linha e aspas das pontas; vazia vira `undefined`. */
export function cleanApiKey(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const cleaned = raw.replace(/\s+/g, '').replace(/^["']+|["']+$/g, '');
  return cleaned === '' ? undefined : cleaned;
}
