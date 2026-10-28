/** Contexto de um atalho a partir de uma tela do app (spec 031, US6). */
export type ShortcutContext =
  | { readonly kind: 'explain_transaction'; readonly description: string; readonly amountCents: number; readonly date: string }
  | { readonly kind: 'summarize_month'; readonly month: string }
  | { readonly kind: 'card_invoice'; readonly accountName: string; readonly month: string };
