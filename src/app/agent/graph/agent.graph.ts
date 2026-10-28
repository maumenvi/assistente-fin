import { type AgentNodeName } from './agent.node.name.ts';
import { type AgentState } from './agent.state.ts';
import { defineGraph } from './define.graph.ts';
import { type NodeContext } from './node.context.ts';
import { answerNode } from './nodes/answer.node.ts';
import { partialAnswer } from './nodes/partial.answer.ts';
import { reactNode } from './nodes/react.node.ts';
import { respondNode } from './nodes/respond.node.ts';
import { routeNode } from './nodes/route.node.ts';
import { toolsNode } from './nodes/tools.node.ts';

/**
 * O grafo do agente (spec 031, contracts/agent.graph.md), lido de cima a baixo:
 *
 *   route  -> answer (conversa, pedido de escrita, fora de assunto, configuracao)
 *          -> react  (consulta)
 *   answer -> END
 *   react  -> tools   (o modelo pediu ferramentas)
 *          -> respond (o modelo respondeu)
 *   tools  -> react
 *   respond-> react   (uma unica correcao de valores) | END
 *
 * Ao estourar passos, tempo ou custo, `onLimit` entrega o que ja foi apurado.
 */
export const agentGraph = defineGraph<AgentNodeName, AgentState, NodeContext>({
  start: 'route',
  nodes: {
    route: routeNode,
    answer: answerNode,
    react: reactNode,
    tools: toolsNode,
    respond: respondNode,
  },
  onLimit: partialAnswer,
});

