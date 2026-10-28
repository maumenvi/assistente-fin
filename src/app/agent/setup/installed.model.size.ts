/** Tamanho em bilhoes de parametros lido do id (`qwen3:8b` -> 8, `llama3.1:70b` -> 70); `null` se o id nao diz. */
export function installedModelSize(id: string): number | null {
  const match = /[:\-_](\d+(?:\.\d+)?)b\b/i.exec(id);
  return match === null ? null : Number.parseFloat(match[1] as string);
}
