import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { MAX_STEP_PAYLOAD_BYTES, MAX_TOOL_RESULT_BYTES, truncateStep } from '../../../src/app/agent/trace/truncate.step.ts';
import { makeStep } from '../store/support/agent.fixtures.ts';

describe('truncateStep (tetos de 32 KB e 16 KB)', () => {
  it('passo pequeno volta identico (mesma referencia)', () => {
    const step = makeStep('r1', 1);
    assert.equal(truncateStep(step), step);
  });

  it('pedido acima de 32 KB vira resumo com marca truncated', () => {
    const step = makeStep('r1', 1, { request: { texto: 'a'.repeat(MAX_STEP_PAYLOAD_BYTES + 10) } });
    const out = truncateStep(step);
    assert.equal(out.truncated, true);
    const request = out.request as { truncated: boolean; originalBytes: number; preview: string };
    assert.equal(request.truncated, true);
    assert.ok(request.originalBytes > MAX_STEP_PAYLOAD_BYTES);
    assert.ok(request.preview.length <= 1024);
    assert.deepEqual(out.response, step.response);
  });

  it('resposta acima de 32 KB tambem', () => {
    const out = truncateStep(makeStep('r1', 1, { response: 'z'.repeat(MAX_STEP_PAYLOAD_BYTES + 1) }));
    assert.equal(out.truncated, true);
    assert.equal((out.response as { truncated: boolean }).truncated, true);
  });

  it('exatamente no teto nao corta', () => {
    const base = makeStep('r1', 1, { request: '' });
    const filler = 'a'.repeat(MAX_STEP_PAYLOAD_BYTES - 2);
    const step = { ...base, request: filler };
    assert.equal(truncateStep(step), step);
  });

  it('resultado de ferramenta acima de 16 KB e cortado e marcado', () => {
    const step = makeStep('r1', 1, {
      toolCalls: [{ id: 'c1', name: 'q', args: {}, resultSummary: 'x'.repeat(MAX_TOOL_RESULT_BYTES + 1), ms: 3, truncated: false }],
    });
    const out = truncateStep(step);
    assert.equal(out.truncated, true);
    assert.equal(out.toolCalls[0]?.truncated, true);
    assert.ok((out.toolCalls[0]?.resultSummary.length ?? 0) < MAX_TOOL_RESULT_BYTES);
  });

  it('valor nao serializavel nao lanca', () => {
    const cyclic: Record<string, unknown> = {};
    cyclic['self'] = cyclic;
    const out = truncateStep(makeStep('r1', 1, { request: cyclic }));
    assert.equal(out.truncated, true);
  });

  it('request/response nulos ou indefinidos nao marcam truncated', () => {
    const out = truncateStep(makeStep('r1', 1, { request: undefined, response: null }));
    assert.equal(out.truncated, false);
  });
});
