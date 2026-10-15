/** Janelas usadas por `matchWalletContent` (spec 028). */
export interface WalletContentWindows {
  /** Com estabelecimento ou cartao igual: ate este tempo desde a criacao do pre-registro. */
  readonly windowMs: number;
  /** Sem nada comparavel alem do valor: ate este tempo (menor). */
  readonly blindWindowMs: number;
}
