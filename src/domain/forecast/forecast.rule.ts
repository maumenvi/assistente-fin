/**
 * Ajuste manual de previsao por categoria (spec 001, RF-19 - "regras definidas pelo
 * usuario"). Estrutura pronta pra `calculateMonthlyForecast` somar no resultado final; nao
 * ha caso de uso de cadastro de regra nesta entrega (plan.md, riscos item 2) - na pratica
 * `rules` chega como lista vazia ate essa tela existir.
 */
export interface ForecastRule {
  /** Id da categoria (spec 003, RF-10). */
  readonly categoryId: string;
  readonly adjustmentCents: number;
}
