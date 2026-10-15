/** Pre-registro pendente da carteira, na forma que `matchWalletContent` precisa (spec 028). */
export interface WalletContentCandidate {
  readonly id: string;
  readonly createdAt: Date;
  readonly amountCents: number | null;
  readonly description: string | null;
  readonly accountId: string | null;
}
