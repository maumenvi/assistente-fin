import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defineGraph } from '../../../src/app/agent/graph/define.graph.ts';
import { describeGraph } from '../../../src/app/agent/graph/describe.graph.ts';
import { END } from '../../../src/app/agent/graph/end.ts';
import { type GraphNode } from '../../../src/app/agent/graph/graph.node.ts';
import { toMermaid } from '../../../src/app/agent/graph/mermaid.ts';
import { NODE_LABELS } from '../../../src/app/agent/graph/node.labels.ts';

type Name = 'route' | 'answer' | 'react';
const node = (to: readonly (Name | typeof END)[]): GraphNode<Name, unknown, unknown> => ({
  to,
  run: () => Promise.reject(new Error('nao executa')),
});

const graph = defineGraph<Name, unknown, unknown>({
  start: 'route',
  nodes: { route: node(['answer', 'react']), answer: node([END]), react: node(['react', END]) },
});

describe('describeGraph e toMermaid', () => {
  it('descreve nos com rotulo e arestas na ordem declarada', () => {
    const description = describeGraph(graph, NODE_LABELS);
    assert.deepEqual(description.nodes, [
      { id: 'route', label: 'Rotear', isStart: true },
      { id: 'answer', label: 'Responder direto', isStart: false },
      { id: 'react', label: 'Raciocinar', isStart: false },
    ]);
    assert.deepEqual(description.edges, [
      { from: 'route', to: 'answer' },
      { from: 'route', to: 'react' },
      { from: 'answer', to: 'END' },
      { from: 'react', to: 'react' },
      { from: 'react', to: 'END' },
    ]);
  });

  it('a descricao e JSON puro', () => {
    const description = describeGraph(graph, NODE_LABELS);
    assert.deepEqual(JSON.parse(JSON.stringify(description)), description);
  });

  it('gera o Mermaid deterministico', () => {
    const expected = [
      'flowchart TD',
      '  route([Rotear])',
      '  answer[Responder direto]',
      '  react[Raciocinar]',
      '  END((Fim))',
      '  route --> answer',
      '  route --> react',
      '  answer --> END',
      '  react --> react',
      '  react --> END',
    ].join('\n');
    assert.equal(toMermaid(describeGraph(graph, NODE_LABELS)), expected);
    assert.equal(toMermaid(describeGraph(graph, NODE_LABELS)), expected);
  });

  it('no sem rotulo e erro (nunca mostra id cru)', () => {
    assert.throws(() => describeGraph(graph, { route: 'Rotear' }), /nos sem rotulo: answer, react/);
  });
});
