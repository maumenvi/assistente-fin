import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { LlmAuthError } from '../../../src/domain/agent/errors/llm.auth.error.ts';
import { LlmModelNotFoundError } from '../../../src/domain/agent/errors/llm.model.not.found.error.ts';
import { LlmProtocolError } from '../../../src/domain/agent/errors/llm.protocol.error.ts';
import { LlmQuotaError } from '../../../src/domain/agent/errors/llm.quota.error.ts';
import { LlmRateLimitedError } from '../../../src/domain/agent/errors/llm.rate.limited.error.ts';
import { LlmUnavailableError } from '../../../src/domain/agent/errors/llm.unavailable.error.ts';
import { mapHttpError } from '../../../src/libs/llm/openai-compat/map.http.error.ts';
import { mapNetworkError } from '../../../src/libs/llm/openai-compat/map.network.error.ts';
import { mapStreamError } from '../../../src/libs/llm/openai-compat/map.stream.error.ts';
import { parseRetryAfter } from '../../../src/libs/llm/openai-compat/parse.retry.after.ts';
import { sanitizeProviderMessage } from '../../../src/libs/llm/openai-compat/sanitize.provider.message.ts';

const NOW = new Date('2026-10-22T12:00:00Z');
const http = (status: number, bodyText = '', retryAfterHeader: string | null = null, emittedContent = false) =>
  mapHttpError({ status, bodyText, retryAfterHeader, now: NOW, emittedContent });

describe('mapHttpError (tabela de contracts/llm.port.md)', () => {
  it('401 e 403 -> auth, nao retentavel', () => {
    for (const status of [401, 403]) {
      const error = http(status);
      assert.ok(error instanceof LlmAuthError);
      assert.equal(error.retriable, false);
    }
  });

  it('402 -> cota; 404 -> modelo', () => {
    assert.ok(http(402) instanceof LlmQuotaError);
    assert.ok(http(404) instanceof LlmModelNotFoundError);
  });

  it('408, 409, 425, 429 -> limite de taxa retentavel, com Retry-After', () => {
    for (const status of [408, 409, 425, 429]) {
      const error = http(status, '', '3');
      assert.ok(error instanceof LlmRateLimitedError);
      assert.equal(error.retriable, true);
      assert.equal(error.retryAfterMs, 3000);
    }
  });

  it('5xx -> indisponivel retentavel, com a mensagem do corpo', () => {
    const error = http(503, JSON.stringify({ error: { message: 'sobrecarga' } }));
    assert.ok(error instanceof LlmUnavailableError);
    assert.equal(error.retriable, true);
    assert.match(error.message, /HTTP 503.*sobrecarga/);
  });

  it('outros 4xx -> protocolo, nao retentavel', () => {
    const error = http(400, JSON.stringify({ error: { message: 'contexto longo demais' } }));
    assert.ok(error instanceof LlmProtocolError);
    assert.equal(error.retriable, false);
  });

  it('corpo que nao e JSON nao quebra', () => {
    assert.ok(http(500, '<html>erro</html>') instanceof LlmUnavailableError);
  });

  it('propaga emittedContent', () => {
    assert.equal(http(429, '', null, true).emittedContent, true);
  });

  it('a mensagem nunca carrega a chave devolvida pelo provedor', () => {
    const body = JSON.stringify({ error: { message: 'Incorrect API key provided: sk-or-v1-abcdef123456. Bearer abc.def' } });
    const error = http(400, body);
    assert.equal(error.message.includes('sk-or-v1'), false);
    assert.equal(error.message.includes('abc.def'), false);
  });
});

describe('mapStreamError', () => {
  it('usa o codigo numerico como status', () => {
    assert.ok(mapStreamError({ code: 429, message: 'x' }, false) instanceof LlmRateLimitedError);
    assert.ok(mapStreamError({ code: '402', message: 'x' }, false) instanceof LlmQuotaError);
  });

  it('sem codigo numerico -> indisponivel', () => {
    const error = mapStreamError({ code: 'server_error', message: 'falhou' }, true);
    assert.ok(error instanceof LlmUnavailableError);
    assert.equal(error.emittedContent, true);
  });
});

describe('mapNetworkError', () => {
  it('rede vira indisponivel retentavel', () => {
    const error = mapNetworkError(new TypeError('fetch failed'), false);
    assert.ok(error instanceof LlmUnavailableError);
    assert.equal(error.retriable, true);
    assert.match(error.message, /sem conexao/);
    assert.equal(error.code, 'OFFLINE');
    assert.equal(error.offline, true);
  });
});

describe('parseRetryAfter', () => {
  it('segundos, data HTTP, ausente, invalido e passado', () => {
    assert.equal(parseRetryAfter('2', NOW), 2000);
    assert.equal(parseRetryAfter('1.5', NOW), 1500);
    assert.equal(parseRetryAfter('Thu, 22 Oct 2026 12:00:05 GMT', NOW), 5000);
    assert.equal(parseRetryAfter(null, NOW), null);
    assert.equal(parseRetryAfter('logo', NOW), null);
    assert.equal(parseRetryAfter('Thu, 22 Oct 2026 11:00:00 GMT', NOW), null);
  });
});

describe('sanitizeProviderMessage', () => {
  it('remove chaves, tokens e corta o tamanho', () => {
    assert.equal(sanitizeProviderMessage('chave sk-abcdef123456 invalida'), 'chave [chave] invalida');
    assert.equal(sanitizeProviderMessage('Authorization: Bearer xyz.123-abc'), 'Authorization: Bearer [chave]');
    assert.ok(sanitizeProviderMessage('a'.repeat(500)).length <= 200);
    assert.equal(sanitizeProviderMessage('linha 1\n\nlinha 2'), 'linha 1 linha 2');
  });
});
