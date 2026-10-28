/** Como o usuario ve o item no cartao: nome curto, estado de hoje, estado depois e o valor movimentado. */
export interface OperationPreview {
  readonly label: string;
  readonly before: readonly string[] | null;
  readonly after: readonly string[];
  readonly amountCents: number | null;
}
