import { END } from './end.ts';
import { type GraphDescription } from './graph.description.ts';

/**
 * Gera o diagrama Mermaid (flowchart) de um grafo descrito. Saida deterministica: nos na ordem
 * declarada (o inicial em formato de estadio), depois as arestas; `END` e um circulo "Fim".
 */
export function toMermaid(description: GraphDescription): string {
  const lines = ['flowchart TD'];
  for (const node of description.nodes) {
    lines.push(node.isStart ? `  ${node.id}([${node.label}])` : `  ${node.id}[${node.label}]`);
  }
  lines.push(`  ${END}((Fim))`);
  for (const edge of description.edges) lines.push(`  ${edge.from} --> ${edge.to}`);
  return lines.join('\n');
}
