import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { defineGraph } from '../../../src/app/agent/graph/define.graph.ts';
import { defineNode } from '../../../src/app/agent/graph/define.node.ts';
import { END } from '../../../src/app/agent/graph/end.ts';
import { initialAgentState } from '../../../src/app/agent/graph/initial.agent.state.ts';

type Name = 'a' | 'b' | 'c';
type State = { readonly path: string };
type Ctx = Record<string, never>;

const node = (to: readonly (Name | typeof END)[]) =>
  ({ to, run: () => Promise.resolve({ next: to[0] as Name | typeof END, state: { path: '' } }) });

describe('defineGraph', () => {
  it('aceita um grafo bem formado e o devolve', () => {
    const graph = defineGraph<Name, State, Ctx>({
      start: 'a',
      nodes: { a: node(['b', 'c']), b: node(['c']), c: node([END]) },
    });
    assert.equal(graph.start, 'a');
  });

  it('recusa no inicial inexistente', () => {
    assert.throws(
      () => defineGraph<Name, State, Ctx>({ start: 'z' as Name, nodes: { a: node([END]), b: node([END]), c: node([END]) } }),
      /no inicial "z" nao existe/,
    );
  });

  it('recusa transicao para no inexistente', () => {
    assert.throws(
      () => defineGraph<Name, State, Ctx>({ start: 'a', nodes: { a: node(['x' as Name]), b: node([END]), c: node([END]) } }),
      /aponta para "x", que nao existe/,
    );
  });

  it('recusa no sem nenhuma saida', () => {
    assert.throws(
      () => defineGraph<Name, State, Ctx>({ start: 'a', nodes: { a: node(['b']), b: node([]), c: node([END]) } }),
      /"b" nao tem nenhuma saida/,
    );
  });

  it('recusa no inalcancavel', () => {
    assert.throws(
      () => defineGraph<Name, State, Ctx>({ start: 'a', nodes: { a: node([END]), b: node([END]), c: node([END]) } }),
      /inalcancaveis.*b, c/,
    );
  });

  it('aceita ciclos (ReAct: raciocinar <-> ferramentas)', () => {
    assert.doesNotThrow(() =>
      defineGraph<Name, State, Ctx>({ start: 'a', nodes: { a: node(['b', 'c']), b: node(['a']), c: node([END]) } }).nodes.a,
    );
  });
});

describe('defineNode (o compilador recusa salto fora de `to`)', () => {
  it('next dentro de `to` compila e roda', async () => {
    const n = defineNode<Name, State, Ctx, 'b' | typeof END>({
      to: ['b', END],
      run: (state) => Promise.resolve({ next: 'b', state }),
    });
    assert.equal((await n.run({ path: 'x' }, {})).next, 'b');
  });

  it('next fora de `to` e erro de tipo', () => {
    defineNode<Name, State, Ctx, 'b'>({
      to: ['b'],
      // @ts-expect-error 'c' nao esta em `to`
      run: (state) => Promise.resolve({ next: 'c', state }),
    });
  });
});

describe('initialAgentState', () => {
  it('comeca vazio e serializavel em JSON', () => {
    const state = initialAgentState('r1');
    assert.equal(state.runId, 'r1');
    assert.equal(state.intent, null);
    assert.deepEqual(state.pendingToolCalls, []);
    assert.equal(state.usage.costMicroUsd, null);
    assert.deepEqual(JSON.parse(JSON.stringify(state)), state);
  });
});
