import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { normalizeForRules } from '../../../src/app/agent/graph/nodes/normalize.for.rules.ts';
import { routeByRules } from '../../../src/app/agent/graph/nodes/route.rules.ts';

describe('routeByRules — sinônimos de categorização e pendentes (T027)', () => {
  it('normaliza acentos e espaços múltiplos em normalizeForRules', () => {
    assert.equal(normalizeForRules('  Arruma   as\ncategorias! '), 'arruma as categorias!');
  });

  it('reconhece sinônimos de escrita para categorizar pendentes como write_request', () => {
    const writePhrases = [
      'categorize tudo que está sem categoria',
      'categoriza tudo que esta sem categoria',
      'arruma as categorias',
      'arrume as categorias pendentes',
      'classifica o que sobrou',
      'classifique o que faltou',
      'reclassifica os lançamentos sem categoria',
      'pode arrumar as categorias pra mim?',
      'quero classificar o que sobrou',
    ];
    for (const phrase of writePhrases) {
      assert.equal(routeByRules(phrase), 'write_request', `esperava write_request para "${phrase}"`);
    }
  });

  it('reconhece perguntas sobre lançamentos pendentes como query', () => {
    const queryPhrases = [
      'o que está sem categoria?',
      'quais lançamentos estão pendentes de classificação?',
      'tem algo sem categoria?',
      'o que falta classificar?',
    ];
    for (const phrase of queryPhrases) {
      assert.equal(routeByRules(phrase), 'query', `esperava query para "${phrase}"`);
    }
  });
});

