const NOISE = /\b(compra|deb|debito|credito|cred|pix|ted|doc|pagamento|pag|transf|transferencia|em|no|na|de|do|da|loja|ltda|sa|me)\b/g;

/**
 * Reduz a descricao ao comerciante: minusculas, sem acento, sem numeros/pontuacao e sem palavras
 * de meio de pagamento. Devolve `null` quando nada util sobra.
 */
export function normalizeMerchant(description: string): string | null {
  const plain = description
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .replace(NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length >= 2 ? plain : null;
}
