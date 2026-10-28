import { MAX_CHAT_CHARS } from './can.send.message.ts';

/** Tamanho maximo guardado de um rascunho (acima disso o envio ja seria recusado). */
export const MAX_DRAFT_CHARS = MAX_CHAT_CHARS + 200;

/** O rascunho vale a pena guardar: tem texto de verdade (so espacos nao conta). */
export function shouldPersistDraft(text: string): boolean {
  return text.trim().length > 0;
}

/**
 * O rascunho deve sumir: a pergunta foi ENVIADA com sucesso, ou o campo ficou vazio. Falha de envio
 * (sem modelo, sem consentimento, sem rede) mantem o texto para o usuario tentar de novo.
 */
export function shouldClearDraft(input: { readonly sent: boolean; readonly text: string }): boolean {
  return input.sent || !shouldPersistDraft(input.text);
}

/** Corta o rascunho no tamanho maximo guardado. */
export function clampDraft(text: string): string {
  return text.length > MAX_DRAFT_CHARS ? text.slice(0, MAX_DRAFT_CHARS) : text;
}
