/**
 * Formata centavos inteiros como moeda pt-BR: `128460` -> "R$ 1.284,60"; negativo -> "-R$ 10,00".
 * So aritmetica inteira (sem ponto flutuante). Lanca `RangeError` para valor nao inteiro.
 */
export function formatBrl(cents: number): string {
  if (!Number.isSafeInteger(cents)) throw new RangeError(`centavos invalidos: ${String(cents)}`);
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const reais = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, '0');
  const grouped = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}R$ ${grouped},${rest}`;
}
