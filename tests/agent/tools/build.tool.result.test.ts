import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildToolError } from '../../../src/app/agent/tools/shared/build.tool.error.ts';
import { buildToolResult } from '../../../src/app/agent/tools/shared/build.tool.result.ts';

const summary = { tool: 'query_transactions', label: 'lancamentos de set/2026', filters: { mes: '2026-09' }, itemCount: 38, truncated: false };

describe('buildToolResult', () => {
  it('envolve o texto em <dados origem="...">', () => {
    const result = buildToolResult({ tool: 'query_transactions', body: 'total R$ 1.284,60', facts: [], summary });
    assert.equal(result.ok, true);
    assert.equal(result.contentForModel, '<dados origem="query_transactions">\ntotal R$ 1.284,60\n</dados>');
    assert.equal(result.summary.truncated, false);
  });

  it('respeita o teto de 6.000 caracteres e marca truncated', () => {
    const result = buildToolResult({ tool: 't', body: 'x'.repeat(10_000), facts: [], summary });
    assert.ok(result.contentForModel.length <= 6000);
    assert.ok(result.contentForModel.endsWith('</dados>'));
    assert.match(result.contentForModel, /resultado cortado/);
    assert.equal(result.summary.truncated, true);
  });

  it('teto configuravel; texto que cabe nao e cortado', () => {
    const small = buildToolResult({ tool: 't', body: 'x'.repeat(100), facts: [], summary, maxChars: 500 });
    assert.equal(small.summary.truncated, false);
    const cut = buildToolResult({ tool: 't', body: 'x'.repeat(1000), facts: [], summary, maxChars: 300 });
    assert.ok(cut.contentForModel.length <= 300);
  });

  it('leva os fatos', () => {
    const facts = [{ id: 'f', kind: 'money' as const, value: 128460, display: 'R$ 1.284,60', label: 'Mercado', sourceCallId: 'c1' }];
    assert.deepEqual(buildToolResult({ tool: 't', body: 'b', facts, summary }).facts, facts);
  });
});

describe('buildToolError', () => {
  it('devolve ok:false com texto curto e erro tipado', () => {
    const result = buildToolError('query_transactions', { code: 'invalid_args', message: 'argumentos invalidos (from: obrigatorio)' });
    assert.equal(result.ok, false);
    assert.match(result.contentForModel, /erro \(invalid_args\)/);
    assert.equal(result.error?.code, 'invalid_args');
    assert.deepEqual(result.facts, []);
    assert.equal(result.summary.itemCount, 0);
  });
});
