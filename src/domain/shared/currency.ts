/**
 * Moedas suportadas pelo dominio.
 *
 * A primeira entrega e focada em uso pessoal no Brasil (spec 001), por isso apenas `BRL`.
 * O tipo existe para tornar a expansao futura explicita e checada pelo compilador.
 */
export type Currency = 'BRL';

/** Moeda padrao usada quando a entrada nao especifica. */
export const DEFAULT_CURRENCY: Currency = 'BRL';
