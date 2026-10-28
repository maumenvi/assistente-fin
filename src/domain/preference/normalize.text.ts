/** Minusculas, sem acento e sem pontuacao, com espacos colapsados (para casar frases em pt-BR). */
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s$%]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
