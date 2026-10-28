import { LlmAuthError } from '../../../domain/agent/errors/llm.auth.error.ts';
import { LlmKeyExpiredError } from '../../../domain/agent/errors/llm.key.expired.error.ts';
import { LlmQuotaError } from '../../../domain/agent/errors/llm.quota.error.ts';
import { type NoticePart } from '../../../domain/agent/notice.part.ts';
import { SETTINGS_ROUTE } from '../graph/nodes/settings.route.ts';

const OPEN_SETTINGS = { label: 'Abrir configuração', route: SETTINGS_ROUTE } as const;

/**
 * Erro de chave/credito -> aviso acionavel na conversa (spec 035, contracts/conversation.notices.md). Nunca repete a
 * mensagem crua do provedor. Outros erros: `null` (continuam com o texto de `describeAgentError`).
 */
export function noticeOfError(error: unknown, providerName: string): NoticePart | null {
  if (error instanceof LlmKeyExpiredError) {
    return { type: 'notice', kind: 'key_expired', title: 'Sua chave venceu', text: 'A chave expirou. Crie outra com validade longa e cole na configuração.', action: OPEN_SETTINGS };
  }
  if (error instanceof LlmAuthError) {
    return { type: 'notice', kind: 'key_rejected', title: `Sua chave do ${providerName} foi recusada`, text: `O ${providerName} não aceitou a chave. Gere uma nova e cole na configuração. Nada foi enviado ao modelo.`, action: OPEN_SETTINGS };
  }
  if (error instanceof LlmQuotaError) {
    return { type: 'notice', kind: 'quota_exhausted', title: `O crédito do ${providerName} acabou`, text: `A chave está certa, mas o saldo ou o limite chegou ao fim. Adicione saldo no ${providerName} e tente de novo.`, action: OPEN_SETTINGS };
  }
  return null;
}
