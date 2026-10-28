/** Sugestao da conversa vazia. `sendNow` envia como se digitada; sem ele, so preenche o campo para ajustar. */
export interface ChatSuggestion {
  readonly label: string;
  readonly text: string;
  readonly sendNow: boolean;
}

/** Sugestoes fixas da conversa vazia (iguais no desktop e no celular). */
export const EMPTY_CHAT_SUGGESTIONS: readonly ChatSuggestion[] = Object.freeze([
  { label: 'Resumo do mês', text: 'Faça um resumo do mês atual: receitas, despesas e resultado.', sendNow: true },
  { label: 'Maiores gastos', text: 'Quais foram meus maiores gastos neste mês?', sendNow: true },
  { label: 'Fatura do cartão', text: 'Como está a fatura do meu cartão?', sendNow: true },
  { label: 'Posso comprar isto?', text: 'Posso comprar [item] de R$ [valor] neste mês?', sendNow: false },
]);
