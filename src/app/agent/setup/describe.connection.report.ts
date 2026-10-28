import { type ConnectionReport } from '../../../domain/agent/connection/connection.report.ts';
import { type ConnectionStep } from '../../../domain/agent/connection/connection.step.ts';
import { CONTEXT_REQUIREMENTS } from '../../../domain/agent/connection/context.requirements.ts';
import { PROVIDERS } from '../../../domain/agent/provider/provider.catalog.ts';
import { type ProviderId } from '../../../domain/agent/provider/provider.id.ts';
import { type DescribedStep } from './described.step.ts';
import { type ReportAction } from './report.action.ts';

const OLLAMA_CONTEXT_COMMAND = 'OLLAMA_CONTEXT_LENGTH=16384 ollama serve';
const CREDIT_LINK = 'https://openrouter.ai/settings/credits';
const KEYS_LINK: Readonly<Record<ProviderId, string>> = {
  openrouter: 'https://openrouter.ai/keys',
  google: 'https://aistudio.google.com/api-keys',
  ollama: 'https://ollama.com/download',
};

const thousand = (tokens: number): number => Math.round(tokens / 1024);
const text = (step: ConnectionStep, key: string): string => String(step.detail?.[key] ?? '');
const guide = (provider: ProviderId | 'custom', anchor: string, label = 'Ver o guia'): ReportAction | undefined => (provider === 'custom' ? undefined : { label, kind: 'guide', target: `${provider}#${anchor}` });

interface Texts {
  readonly title: string;
  readonly detail: string;
  readonly action?: ReportAction | undefined;
}

function textsFor(step: ConnectionStep, provider: ProviderId | 'custom'): Texts {
  const name = provider === 'custom' ? 'O servidor' : PROVIDERS[provider].label;
  switch (step.code) {
    case 'reach.ok': return { title: 'Servidor alcançado', detail: `Consegui falar com ${name}.` };
    case 'reach.offline': return { title: 'Sem conexão', detail: 'Não consegui falar com o servidor. Verifique a internet e tente de novo — isso não é problema da chave.' };
    case 'reach.timeout': return { title: 'O servidor demorou demais', detail: 'O servidor não respondeu a tempo. Tente de novo em instantes.' };
    case 'reach.local_down': return { title: 'O Ollama não está ligado', detail: 'Não encontrei o Ollama neste computador. Abra o Ollama (ou rode "ollama serve") e tente de novo.', action: guide(provider, 'install') };
    case 'key.ok': return { title: 'Chave aceita', detail: step.detail?.['remainingUsd'] === undefined ? 'A chave foi aceita.' : `A chave foi aceita. Saldo restante: US$ ${text(step, 'remainingUsd')}.` };
    case 'key.not_needed': return { title: 'Sem chave', detail: 'O Ollama roda neste computador e não precisa de chave.' };
    case 'key.missing': return { title: 'Falta a chave', detail: 'Cole a chave do provedor para continuar.', action: guide(provider, 'key', 'Onde pego a chave?') };
    case 'key.invalid': return { title: 'A chave não foi aceita', detail: `Gere uma nova e cole de novo.${step.detail?.['looksLike'] === undefined ? '' : ` Esta parece uma chave do ${text(step, 'looksLike')}.`}`, action: guide(provider, 'key', 'Ver o passo da chave') };
    case 'key.expired': return { title: 'A chave venceu', detail: 'Gere uma nova chave e, ao criar, escolha uma validade longa (o padrão do site é só 1 dia).', action: guide(provider, 'validity', 'Ver o passo da validade') };
    case 'key.no_credit': return { title: 'O crédito acabou', detail: 'A chave é válida, mas o crédito acabou. Adicione saldo ou aumente o limite da chave.', action: provider === 'openrouter' ? { label: 'Abrir o OpenRouter', kind: 'link', target: CREDIT_LINK } : guide(provider, 'key') };
    case 'key.expiring': return { title: 'A chave vence em breve', detail: `Vence em ${text(step, 'days')} dia(s). Crie outra com validade longa antes disso.`, action: guide(provider, 'validity') };
    case 'key.looks_like_other': return { title: 'Parece uma chave de outro provedor', detail: `Esta chave parece ser do ${text(step, 'looksLike')}. Se der erro, confira se escolheu o provedor certo.` };
    case 'model.ok': return { title: 'Modelo encontrado', detail: step.detail?.['model'] === undefined ? 'O modelo existe.' : `Modelo: ${text(step, 'model')}.` };
    case 'model.default_replaced': return { title: 'O modelo padrão mudou', detail: `O padrão antigo saiu da lista do provedor; vou usar ${text(step, 'model')}.` };
    case 'model.not_found': return { title: 'Modelo não encontrado', detail: `${step.detail?.['model'] === undefined ? 'O provedor não tem' : `O provedor não tem o modelo ${text(step, 'model')}`}.${step.detail?.['suggestion'] === undefined ? '' : ` Use ${text(step, 'suggestion')}.`}`, action: { label: 'Abrir o Avançado', kind: 'settings', target: 'advanced' } };
    case 'model.none_installed': return { title: 'Nenhum modelo servível instalado', detail: 'Instale um modelo que consulta os seus dados rodando o comando abaixo e tente de novo.', action: { label: 'Copiar o comando', kind: 'command', target: text(step, 'command') || 'ollama pull qwen3:8b' } };
    case 'tools.ok': return { title: 'Consulta aos seus dados funciona', detail: 'O modelo sabe usar as ferramentas do app.' };
    case 'tools.not_required': return { title: 'Ferramentas não necessárias aqui', detail: 'Este modelo é usado para tarefas curtas; não precisa consultar os seus dados.' };
    case 'tools.unsupported': return { title: 'O modelo não consulta os seus dados', detail: `O modelo ${text(step, 'model')} não sabe consultar seus dados: o assistente só conseguiria conversar.${step.detail?.['suggestion'] === undefined ? '' : ` Use ${text(step, 'suggestion')} (padrão).`}`, action: { label: 'Voltar ao padrão', kind: 'settings', target: 'default-model' } };
    case 'tools.stream_incompatible': return { title: 'O formato de resposta do modelo não é compatível', detail: `O modelo ${text(step, 'model')} respondeu em um formato que o app não consegue ler (${stageText(step)}). Escolha outro modelo.` };
    case 'context.ok': return { title: 'Memória suficiente', detail: `Janela de contexto de ${thousand(Number(step.detail?.['tokens'] ?? 0))} mil tokens.` };
    case 'context.short': return { title: 'Memória um pouco curta', detail: `A janela é de ${thousand(Number(step.detail?.['tokens'] ?? 0))} mil tokens; funciona, mas o ideal são ${thousand(CONTEXT_REQUIREMENTS.recommendedTokens)} mil.`, action: provider === 'ollama' ? { label: 'Copiar o comando', kind: 'command', target: OLLAMA_CONTEXT_COMMAND } : undefined };
    case 'context.too_small': return { title: 'Memória pequena demais', detail: `Seu Ollama usa ${thousand(Number(step.detail?.['tokens'] ?? 0))} mil tokens; o assistente precisa de pelo menos ${thousand(CONTEXT_REQUIREMENTS.minTokens)} mil (ideal ${thousand(CONTEXT_REQUIREMENTS.recommendedTokens)} mil).`, action: { label: 'Copiar o comando', kind: 'command', target: OLLAMA_CONTEXT_COMMAND } };
    case 'context.unknown': return { title: 'Memória não verificada', detail: 'Não consegui saber o tamanho da janela de contexto; o assistente tentará usar normalmente.' };
    default: return step.status === 'skipped' ? { title: 'Será verificado depois', detail: 'Corrija a etapa anterior e teste de novo.' } : { title: 'Etapa concluída', detail: '' };
  }
}

/**
 * Relatorio de conexao -> texto em portugues e acao sugerida de cada etapa (spec 035, contracts/connection.report.md).
 * Funcao UNICA usada pelo desktop e pelo Android (mesmo relatorio => mesmo texto). Nunca imprime a chave.
 */
export function describeConnectionReport(report: ConnectionReport, provider: ProviderId | 'custom'): readonly DescribedStep[] {
  return report.steps.map((step): DescribedStep => {
    const texts = textsFor(step, provider);
    const action = texts.action ?? (step.status === 'failed' && step.code.startsWith('key.') && provider !== 'custom' ? { label: 'Abrir o site do provedor', kind: 'link' as const, target: KEYS_LINK[provider] } : undefined);
    return { id: step.id, status: step.status, title: texts.title, detail: texts.detail, ...(action === undefined ? {} : { action }) };
  });
}

/** Descricao curta da etapa do stream que falhou (spec 037). */
function stageText(step: ConnectionStep): string {
  switch (step.detail?.['stage']) {
    case 'fim_inesperado': return 'a resposta terminou antes do fim';
    case 'sem_saida': return 'nenhuma resposta veio';
    default: return 'uma parte da resposta fora do formato';
  }
}
