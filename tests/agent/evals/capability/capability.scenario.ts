/**
 * Cenario da avaliacao de capacidades (spec 034, SC-006): uma lacuna que as ferramentas do app nao resolvem, o que o
 * gabarito espera achar no catalogo e como o modelo CORRETO se comporta (busca e para; nunca conecta).
 */
export interface CapabilityScenario {
  readonly id: string;
  readonly question: string;
  /** Slug que o gabarito espera no cartao; `none` = nada no catalogo; `not_applicable` = nem deve procurar (fora do assunto). */
  readonly expected: 'cambio' | 'planejamento-aposentadoria' | 'none' | 'not_applicable';
  /** O que o modelo correto manda em `find_capability` (nao se aplica a `not_applicable`). */
  readonly query?: string;
}
