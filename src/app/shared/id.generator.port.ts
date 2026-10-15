/**
 * Porta para geracao de identificadores.
 *
 * O dominio e os casos de uso nao produzem efeitos colaterais (rule 8): quem precisa de um
 * novo id recebe esta porta por injecao. Facilita testes deterministicos com um gerador
 * sequencial em memoria.
 */
export interface IdGenerator {
  /** Devolve um novo identificador unico. */
  next(): string;
}
