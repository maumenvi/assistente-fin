import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FactLedger } from '../../../src/app/agent/verify/fact.ledger.ts';
import { verifyFigures } from '../../../src/app/agent/verify/verify.figures.ts';
import { routeByRules } from '../../../src/app/agent/graph/nodes/route.rules.ts';

const loss = { id: 'f1', kind: 'money' as const, value: -671874, display: '-R$ 6.718,74', label: 'resultado', sourceCallId: 'c1' };

describe('valor confere pelo modulo (sinal escrito de outro jeito)', () => {
  it('"−R$", "– R$" e "R$" sem sinal conferem com o fato negativo', () => {
    for (const text of ['Resultado: −R$ 6.718,74', 'Resultado: – R$ 6.718,74', 'Resultado negativo de R$ 6.718,74', 'Resultado: -R$ 6.718,74']) {
      assert.equal(verifyFigures(text, new FactLedger([loss])).ok, true, text);
    }
  });
  it('valor diferente continua barrado', () => {
    assert.equal(verifyFigures('Resultado: −R$ 6.718,75', new FactLedger([loss])).ok, false);
  });
});

describe('seguir a conversa', () => {
  it('"ficou incompleto", "continue" vao ao laco com ferramentas', () => {
    for (const t of ['acho que ficou incompleto', 'continue', 'pode continuar a resposta?', 'a resposta foi cortada']) assert.equal(routeByRules(t), 'query', t);
  });
});
