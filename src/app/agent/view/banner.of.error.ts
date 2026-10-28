import { describeAgentError } from '../errors/describe.agent.error.ts';
import { type ChatBanner } from './chat.banner.ts';

/** Faixa de aviso para erros que o usuario resolve em configuracoes ou conexao; os demais ficam na mensagem. */
export function bannerOfError(code: string | null | undefined): ChatBanner | null {
  switch (code) {
    case 'NO_MODEL_CONFIGURED':
      return { kind: 'no_model', text: describeAgentError(code) };
    case 'CONSENT_REQUIRED':
      return { kind: 'consent_required', text: describeAgentError(code) };
    case 'OFFLINE':
      return { kind: 'offline', text: describeAgentError(code) };
    case 'LOCAL_ONLY_VIOLATION':
      return { kind: 'local_only', text: describeAgentError(code) };
    case 'LLM_UNAVAILABLE':
      return { kind: 'provider_down', text: describeAgentError(code) };
    default:
      return null;
  }
}
