import { type Candidate } from '../../../../domain/capability/candidate.ts';

/** Entrada do catalogo curado: o candidato mais as palavras que o fazem aparecer numa busca. */
export interface CuratedEntry {
  readonly keywords: readonly string[];
  readonly candidate: Candidate;
}

/**
 * Catalogo curado do app (spec 034, contracts/catalog.md): lista versionada no repositorio, revisada a mao.
 * Entra primeiro na ordenacao. Acrescentar uma entrada e um commit revisado, nunca algo que o modelo faz.
 */
export const CURATED_ENTRIES: readonly CuratedEntry[] = [
  {
    keywords: ['cotacao', 'cambio', 'moeda', 'moedas', 'dolar', 'euro', 'converter', 'conversao', 'usd', 'brl', 'eur'],
    candidate: {
      kind: 'mcp',
      slug: 'cambio',
      name: 'Cotação de moedas',
      publisher: 'Banco Aberto de Câmbio',
      description: 'Converte valores entre moedas pela cotação do dia.',
      origin: { source: 'curated', ref: 'cambio', url: 'https://cambio.exemplo.com.br' },
      badge: 'curated',
      endpointUrl: 'https://cambio.exemplo.com.br/mcp',
      transport: 'streamable-http',
      declaredEgress: ['moeda de origem', 'moeda de destino', 'valor a converter'],
      permissions: ['network', 'sends_financial_values', 'needs_credential'],
      credentialSpec: [{ name: 'Authorization', label: 'Chave de acesso', secret: true, header: 'Authorization' }],
      platforms: ['desktop', 'android'],
    },
  },
  {
    keywords: ['aposentadoria', 'previdencia', 'planejamento', 'longo', 'prazo', 'investimento'],
    candidate: {
      kind: 'skill',
      slug: 'planejamento-aposentadoria',
      name: 'Planejamento de aposentadoria',
      publisher: 'livre-dev',
      description: 'Instruções para orientar o planejamento de aposentadoria. Só orienta; não executa código.',
      origin: { source: 'github', ref: 'livre-dev/skills/planejamento-aposentadoria', url: 'https://github.com/livre-dev/skills' },
      badge: 'unverified',
      transport: 'skill',
      declaredEgress: [],
      permissions: ['network'],
      credentialSpec: [],
      platforms: ['desktop', 'android'],
    },
  },
];
