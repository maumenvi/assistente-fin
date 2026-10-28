const BR_NUMBER = /^(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?$/;

/**
 * Le um valor em reais escrito em pt-BR e devolve centavos: "1.284,60", "1284,60", "1284",
 * "R$ 1.284,60", "-10,5". O ponto so vale como separador de milhar; `1284.5` (formato
 * americano) e texto invalido devolvem `null`. Sem ponto flutuante.
 */
export function parseBrlToCents(text: string): number | null {
  let clean = text.trim();
  let negative = false;
  if (clean.startsWith('-')) {
    negative = true;
    clean = clean.slice(1).trim();
  }
  clean = clean.replace(/^R\$\s*/i, '');
  if (!negative && clean.startsWith('-')) {
    negative = true;
    clean = clean.slice(1).trim();
  }
  const match = BR_NUMBER.exec(clean);
  if (!match) return null;
  const reais = Number.parseInt((match[1] as string).replace(/\./g, ''), 10);
  const decimals = match[2] === undefined ? 0 : Number.parseInt(match[2].padEnd(2, '0'), 10);
  const cents = reais * 100 + decimals;
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}
