import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { redact } from '../../../src/app/agent/log/redact.ts';

describe('redact (SC-009)', () => {
  it('mascara chaves de objeto com cara de segredo, em qualquer nivel', () => {
    const out = redact({
      model: 'm',
      authorization: 'Bearer abc',
      apiKey: 'sk-or-v1-aaaaaaaaaa',
      headers: { 'x-api-key': 'k', 'X-Title': 'Assistente Fin' },
      nested: { list: [{ token: 't', accessToken: 'u', password: 'p', secretValue: 's', ok: 1 }] },
    });
    assert.deepEqual(out, {
      model: 'm',
      authorization: '[REDACTED]',
      apiKey: '[REDACTED]',
      headers: { 'x-api-key': '[REDACTED]', 'X-Title': 'Assistente Fin' },
      nested: { list: [{ token: '[REDACTED]', accessToken: '[REDACTED]', password: '[REDACTED]', secretValue: '[REDACTED]', ok: 1 }] },
    });
  });

  it('mascara chaves sk-... e Bearer dentro de textos', () => {
    assert.equal(redact('falha com sk-or-v1-abcdef123456 e Bearer xyz.123'), 'falha com [REDACTED] e Bearer [REDACTED]');
  });

  it('mascara a chave dentro de uma string de erro e de um Error', () => {
    const error = new Error('401 para sk-test-SEGREDO99');
    const out = redact({ error }) as { error: { name: string; message: string; stack: string | null } };
    assert.equal(out.error.name, 'Error');
    assert.equal(out.error.message, '401 para [REDACTED]');
    assert.equal(JSON.stringify(out).includes('SEGREDO99'), false);
  });

  it('nao muta a entrada', () => {
    const input = { apiKey: 'sk-aaaaaaaa', list: ['sk-bbbbbbbb'] };
    redact(input);
    assert.deepEqual(input, { apiKey: 'sk-aaaaaaaa', list: ['sk-bbbbbbbb'] });
  });

  it('valores nulos de chaves secretas continuam nulos (nada a esconder)', () => {
    assert.deepEqual(redact({ apiKey: null, token: undefined }), { apiKey: null, token: undefined });
  });

  it('tolera ciclos, datas, funcoes e profundidade excessiva sem lancar', () => {
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic['self'] = cyclic;
    assert.equal((redact(cyclic) as Record<string, unknown>)['self'], '[circular]');
    assert.equal(redact(new Date('2026-10-22T12:00:00Z')), '2026-10-22T12:00:00.000Z');
    assert.equal(redact(() => 1), '[function]');
    let deep: Record<string, unknown> = { leaf: 'sk-aaaaaaaa' };
    for (let i = 0; i < 20; i += 1) deep = { child: deep };
    assert.doesNotThrow(() => redact(deep));
    assert.equal(JSON.stringify(redact(deep)).includes('sk-aaaaaaaa'), false);
  });

  it('valores primitivos passam', () => {
    assert.equal(redact(42), 42);
    assert.equal(redact(true), true);
    assert.equal(redact(null), null);
  });
});
