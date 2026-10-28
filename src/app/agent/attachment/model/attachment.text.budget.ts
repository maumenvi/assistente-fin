import { ATTACHMENT_LIMITS } from '../../../../domain/agent/attachment/attachment.limits.ts';

/** Tokens do prompt do sistema + ferramentas do agente (medido na spec 035: > 6 mil; margem). */
export const AGENT_PROMPT_TOKENS = 7000;
/** Tokens reservados para a resposta do modelo. */
const ANSWER_TOKENS = 2000;
/** Custo estimado de uma imagem no contexto. */
const IMAGE_TOKENS = 1500;
/** Parte do espaco livre que o texto do anexo pode ocupar. */
const SHARE = 0.4;
/** Caracteres por token (conservador para pt-BR). */
const CHARS_PER_TOKEN = 3;
/** Menor orcamento util: cabe o cabecalho do anexo (nome, abas, colunas, totais). */
export const MIN_USEFUL_CHARS = 400;

export interface AttachmentBudgetInput {
  /** Tokens ja ocupados pelo historico da conversa (estimativa). */
  readonly historyTokens?: number;
  /** Imagens que irao no mesmo pedido. */
  readonly imageCount?: number;
  /** Substitui o espaco reservado ao prompt (testes). */
  readonly reservedTokens?: number;
}

/**
 * Orcamento de texto de anexo em CARACTERES, dimensionado pela janela do modelo (spec 036, research R13): janela menos prompt,
 * historico, resposta e imagens; o anexo usa ate 40% disso, com teto de 48 000 e SEM minimo fixo. `null` quando nem o cabecalho
 * do anexo cabe (o envio e bloqueado com "janela insuficiente").
 */
export function attachmentTextBudget(contextWindowTokens: number, input: AttachmentBudgetInput = {}): number | null {
  const reserved = input.reservedTokens ?? AGENT_PROMPT_TOKENS;
  const available = contextWindowTokens - reserved - (input.historyTokens ?? 0) - ANSWER_TOKENS - IMAGE_TOKENS * (input.imageCount ?? 0);
  if (available <= 0) return null;
  const chars = Math.min(ATTACHMENT_LIMITS.maxModelTextChars, Math.floor(available * SHARE) * CHARS_PER_TOKEN);
  return chars < MIN_USEFUL_CHARS ? null : chars;
}
