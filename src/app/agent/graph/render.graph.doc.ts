import { type GraphDescription } from './graph.description.ts';
import { toMermaid } from './mermaid.ts';

/** Para cada no: o que faz e se usa modelo (a tabela do documento). */
const NODE_NOTES: Readonly<Record<string, { readonly uses: string; readonly does: string }>> = {
  route: { uses: 'modelo rápido, só se as regras forem inconclusivas', does: 'descobre a intenção do pedido (consulta, conversa, escrita, configuração, fora de assunto)' },
  answer: { uses: 'modelo rápido só em conversa simples', does: 'responde sem consultar dados; pedidos de escrita, configuração e fora de assunto têm texto fixo' },
  react: { uses: 'modelo principal', does: 'raciocina e decide: pedir ferramentas ou responder; troca para o alternativo se o principal falhar' },
  tools: { uses: 'nenhum', does: 'executa as consultas em paralelo e alimenta o livro-razão de fatos' },
  respond: { uses: 'nenhum', does: 'confere cada valor da resposta contra os fatos; corrige uma vez ou oculta o que não foi confirmado' },
};

/**
 * Documento `docs/agent/graph.md`: diagrama Mermaid e tabela de nos, gerados do proprio grafo
 * (spec 031, T074). O teste regenera em memoria e falha se o arquivo estiver desatualizado.
 */
export function renderGraphDoc(description: GraphDescription): string {
  const rows = description.nodes.map((node) => {
    const note = NODE_NOTES[node.id];
    const targets = description.edges.filter((e) => e.from === node.id).map((e) => e.to).join(', ');
    return `| \`${node.id}\` | ${node.label} | ${targets} | ${note?.uses ?? ''} | ${note?.does ?? ''} |`;
  });
  return [
    '# Grafo do agente',
    '',
    '> Gerado por `npm run agent:graph` a partir de `src/app/agent/graph/agent.graph.ts`. Não edite à mão.',
    '',
    '```mermaid',
    toMermaid(description),
    '```',
    '',
    '| Nó | Rótulo | Vai para | Usa modelo | O que faz |',
    '|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}
