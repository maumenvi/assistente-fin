/**
 * Gera um id estavel (UUID v5) a partir de um nome (spec 022, H1 da analise): o mesmo nome da
 * sempre o mesmo id, em qualquer aparelho. Usado para os lancamentos criados ao aprovar um
 * pre-registro - aprovar o mesmo pre-registro em dois celulares gera as mesmas linhas, e a
 * sincronizacao nao duplica. Porta (e nao funcao de dominio) porque precisa de SHA-1.
 */
export interface DeterministicIdGenerator {
  derive(name: string): string;
}
