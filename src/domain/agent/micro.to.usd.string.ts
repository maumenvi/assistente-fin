/**
 * Formata micro-dolares como "US$ 0,004": no minimo 2 casas, ate 6, sem zeros finais alem das 2
 * primeiras, e separador de milhar. So aritmetica inteira.
 */
export function microToUsdString(micro: number): string {
  if (!Number.isInteger(micro) || micro < 0) {
    throw new RangeError(`micro-dolares invalido: ${String(micro)}`);
  }
  const whole = Math.floor(micro / 1_000_000);
  let fraction = String(micro % 1_000_000).padStart(6, '0');
  fraction = fraction.replace(/0+$/, '').padEnd(2, '0');
  const thousands = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `US$ ${thousands},${fraction}`;
}
