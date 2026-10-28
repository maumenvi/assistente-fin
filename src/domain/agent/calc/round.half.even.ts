/**
 * Divide `numerator` por `denominator` (`> 0n`) com arredondamento half-even (banker's rounding)
 * em BigInt (spec 037, R4). No empate exato (`.5`), arredonda para o inteiro par mais proximo.
 */
export function roundHalfEven(numerator: bigint, denominator: bigint): bigint {
  const sign = numerator < 0n ? -1n : 1n;
  const absNum = numerator < 0n ? -numerator : numerator;
  let quotient = absNum / denominator;
  const twiceRem = (absNum % denominator) * 2n;
  if (twiceRem > denominator || (twiceRem === denominator && (quotient & 1n) === 1n)) {
    quotient += 1n;
  }
  return sign * quotient;
}

