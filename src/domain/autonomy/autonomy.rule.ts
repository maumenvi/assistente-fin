/** Regra de uma acao: liga/desliga e os limites que mantem a aprovacao acima deles. */
export interface AutonomyRule {
  readonly enabled: boolean;
  readonly maxAmountCents: number;
  readonly maxItems: number;
}
