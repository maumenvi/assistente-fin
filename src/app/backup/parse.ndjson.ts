/**
 * Quebra um texto NDJSON em records (spec 002, RF-38) - usado por `RestoreDataSnapshot` pra
 * reimportar o `payload` de um `DataSnapshot`. Linhas em branco sao ignoradas; cada linha
 * nao vazia vira `JSON.parse` (a validacao de forma fica com `importBackupRecords`).
 */
export function parseNdjson(text: string): unknown[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => JSON.parse(line));
}
