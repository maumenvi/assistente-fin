/**
 * Porta para obter o instante atual.
 *
 * Mesma razao do `IdGenerator` (rule 8): quem precisa de "agora" recebe esta porta por
 * injecao, em vez de chamar `new Date()` direto no caso de uso - mantem tudo deterministico
 * e testavel.
 */
export interface Clock {
  /** Devolve o instante atual. */
  now(): Date;
}
