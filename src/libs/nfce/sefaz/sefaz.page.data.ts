/** O que se extrai da pagina de consulta da NFC-e (spec 022, T089). */
export interface SefazPageData {
  readonly amountCents: number;
  /** "AAAA-MM-DD". */
  readonly date: string;
  readonly merchant: string;
}
