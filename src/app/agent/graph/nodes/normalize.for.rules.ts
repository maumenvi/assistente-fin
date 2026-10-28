/** Minusculas, sem acentos e com espacos colapsados, para casar palavras sem depender de como o usuario digitou. */
export function normalizeForRules(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
