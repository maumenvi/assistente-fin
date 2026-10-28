import { type LlmMessage } from '../../ports/llm/llm.message.ts';

/**
 * Texto da pergunta do usuario na rodada em curso: a PRIMEIRA parte de texto da primeira mensagem `user` do turno. As partes
 * seguintes sao conteudo de anexo (dado externo, spec 036) e nunca decidem roteamento, memoria nem verificacao de valores.
 */
export function userTextOfTurn(turn: readonly LlmMessage[]): string {
  const first = turn.find((message) => message.role === 'user');
  if (first === undefined || first.role !== 'user') return '';
  const text = first.content.find((part) => part.type === 'text');
  return text?.type === 'text' ? text.text : '';
}

/** O turno trouxe anexo(s): partes alem da pergunta (bloco de dado externo ou imagem). */
export function turnHasAttachments(turn: readonly LlmMessage[]): boolean {
  const first = turn.find((message) => message.role === 'user');
  if (first === undefined || first.role !== 'user') return false;
  return first.content.some((part, index) => part.type === 'image' || (index > 0 && part.type === 'text' && part.text.startsWith('<dado_externo origem="anexo"')));
}
