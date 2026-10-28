import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { routeNode } from '../../../src/app/agent/graph/nodes/route.node.ts';
import { routeByRules } from '../../../src/app/agent/graph/nodes/route.rules.ts';
import { countingLlm, makeNodeHarness } from './support/node.harness.ts';

const TABLE: readonly (readonly [string, string | null])[] = [
  ['quanto gastei com mercado em setembro?', 'query'],
  ['qual meu saldo?', 'query'],
  ['como está a fatura do Nubank', 'query'],
  ['ainda posso gastar com lazer?', 'query'],
  ['vou fechar o mês no azul?', 'query'],
  ['lance um gasto de 50 reais no mercado', 'write_request'],
  ['registre uma despesa de R$ 30', 'write_request'],
  ['apague o lançamento de ontem', 'write_request'],
  ['quero lançar um gasto', 'write_request'],
  ['pague a fatura do cartão', 'write_request'],
  ['classifique a compra da padaria como lazer', 'write_request'],
  ['categorize meus lançamentos sem categoria', 'write_request'],
  ['renomeie a categoria Lazer para Diversão', 'write_request'],
  ['pode corrigir o valor do mercado?', 'write_request'],
  ['quais lançamentos estão sem categoria?', 'query'],
  ['transfira 200 para a poupança', 'write_request'],
  ['mude a autonomia do assistente para aprovar sozinho', 'settings_request'],
  ['ative o modo local', 'settings_request'],
  ['altere minha chave de API', 'settings_request'],
  ['desative a aprovação automática', 'settings_request'],
  ['oi', 'direct'],
  ['bom dia', 'direct'],
  ['obrigado!', 'direct'],
  ['valeu', 'direct'],
  ['me conta uma piada', 'out_of_scope'],
  ['qual a previsão do tempo amanhã?', 'out_of_scope'],
  ['quem ganhou o jogo de futebol?', 'out_of_scope'],
  ['quanto paguei de aluguel este ano?', 'query'],
  ['posso pagar a fatura em duas vezes?', 'query'],
  ['hmm, não sei', null],
];

describe('routeByRules', () => {
  for (const [text, expected] of TABLE) {
    it(`"${text}" -> ${String(expected)}`, () => {
      assert.equal(routeByRules(text), expected);
    });
  }
});

describe('route node', () => {
  it('regras bastam: nenhuma chamada ao modelo; query vai para react, o resto para answer', async () => {
    const fast = countingLlm('{"intent":"direct","confidence":0.9}');
    for (const [text, next] of [
      ['quanto gastei em setembro?', 'react'],
      ['lance um gasto', 'answer'],
      ['oi', 'answer'],
    ] as const) {
      const h = await makeNodeHarness({ userText: text, fast });
      const result = await routeNode.run(h.state, h.node);
      assert.equal(result.next, next);
    }
    assert.equal(fast.calls, 0);
  });

  it('inconclusivo chama o modelo rapido (saida estruturada) e usa a intencao', async () => {
    const fast = countingLlm('{"intent":"direct","confidence":0.9}');
    const h = await makeNodeHarness({ userText: 'hmm, não sei', fast });
    const result = await routeNode.run(h.state, h.node);
    assert.equal(fast.calls, 1);
    assert.equal(result.state.intent, 'direct');
    assert.equal(result.next, 'answer');
    assert.equal(result.detail?.role, 'fast');
    assert.equal(result.state.counters.llmCalls, 1);
  });

  it('sem modelo rapido usa o principal (e informa o papel)', async () => {
    const main = countingLlm('query');
    const h = await makeNodeHarness({ userText: 'hmm, não sei', main });
    const result = await routeNode.run(h.state, h.node);
    assert.equal(main.calls, 1);
    assert.equal(result.detail?.role, 'main');
    assert.equal(result.next, 'react');
  });

  it('falha do roteador, saida ilegivel ou confianca baixa caem em query', async () => {
    const failing = await makeNodeHarness({ userText: 'hmm, não sei', fast: countingLlm('', true) });
    assert.equal((await routeNode.run(failing.state, failing.node)).state.intent, 'query');
    assert.equal(failing.log.warns.length, 1);
    const garbage = await makeNodeHarness({ userText: 'hmm, não sei', fast: countingLlm('???') });
    assert.equal((await routeNode.run(garbage.state, garbage.node)).state.intent, 'query');
    const unsure = await makeNodeHarness({ userText: 'hmm, não sei', fast: countingLlm('{"intent":"out_of_scope","confidence":0.2}') });
    assert.equal((await routeNode.run(unsure.state, unsure.node)).state.intent, 'query');
  });

  it('texto livre com a intencao no meio e JSON dentro de cerca de codigo', async () => {
    const fenced = await makeNodeHarness({ userText: 'hmm, não sei', fast: countingLlm('```json\n{"intent":"write_request","confidence":0.8}\n```') });
    assert.equal((await routeNode.run(fenced.state, fenced.node)).state.intent, 'write_request');
    const word = await makeNodeHarness({ userText: 'hmm, não sei', fast: countingLlm('Acho que é out_of_scope.') });
    assert.equal((await routeNode.run(word.state, word.node)).state.intent, 'out_of_scope');
  });

  it('cancelamento no meio do roteador e propagado', async () => {
    const h = await makeNodeHarness({ userText: 'hmm, não sei', fast: countingLlm('', true) });
    h.controller.abort();
    await assert.rejects(routeNode.run(h.state, h.node));
  });
});
