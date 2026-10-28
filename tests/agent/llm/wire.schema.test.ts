import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { chunkSchema } from '../../../src/libs/llm/openai-compat/chunk.schema.ts';
import { errorBodySchema } from '../../../src/libs/llm/openai-compat/error.schema.ts';
import { modelsSchema } from '../../../src/libs/llm/openai-compat/models.schema.ts';

describe('schemas de resposta (fronteira)', () => {
  it('chunk de texto do OpenRouter, com campos extras ignorados', () => {
    const parsed = chunkSchema.safeParse({
      id: 'gen-1',
      provider: 'Anthropic',
      choices: [{ index: 0, delta: { role: 'assistant', content: 'Ola' }, finish_reason: null, native_finish_reason: null }],
    });
    assert.equal(parsed.success, true);
    assert.equal(parsed.data?.choices?.[0]?.delta?.content, 'Ola');
  });

  it('chunk de ferramenta fragmentada, com index e id apenas no primeiro', () => {
    const first = chunkSchema.parse({
      choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'query', arguments: '' } }] } }],
    });
    const next = chunkSchema.parse({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"a"' } }] } }] });
    assert.equal(first.choices?.[0]?.delta?.tool_calls?.[0]?.id, 'call_1');
    assert.equal(next.choices?.[0]?.delta?.tool_calls?.[0]?.function?.arguments, '{"a"');
  });

  it('ultimo chunk com uso e custo (OpenRouter) e choices vazio', () => {
    const parsed = chunkSchema.parse({
      choices: [],
      usage: { prompt_tokens: 120, completion_tokens: 30, prompt_tokens_details: { cached_tokens: 100 }, cost: 0.0042 },
    });
    assert.equal(parsed.usage?.cost, 0.0042);
    assert.equal(parsed.usage?.prompt_tokens_details?.cached_tokens, 100);
  });

  it('Ollama: campos nulos e ausentes sao toleraveis', () => {
    const parsed = chunkSchema.safeParse({
      choices: [{ delta: { content: '', tool_calls: null }, finish_reason: 'stop' }],
      usage: null,
    });
    assert.equal(parsed.success, true);
  });

  it('erro dentro de um chunk', () => {
    const parsed = chunkSchema.parse({ error: { code: 429, message: 'rate limit' } });
    assert.equal(parsed.error?.code, 429);
  });

  it('chunk fora do formato e recusado', () => {
    assert.equal(chunkSchema.safeParse({ choices: 'nao e lista' }).success, false);
    assert.equal(chunkSchema.safeParse('texto').success, false);
  });

  it('corpo de erro HTTP', () => {
    const parsed = errorBodySchema.parse({ error: { code: 'invalid_api_key', message: 'chave invalida' } });
    assert.equal(parsed.error.message, 'chave invalida');
    assert.equal(errorBodySchema.safeParse({ erro: 1 }).success, false);
  });

  it('lista de modelos com preco em texto e parametros suportados', () => {
    const parsed = modelsSchema.parse({
      data: [
        {
          id: 'anthropic/claude-sonnet',
          context_length: 200000,
          supported_parameters: ['tools', 'tool_choice', 'response_format'],
          architecture: { input_modalities: ['text', 'image'] },
          pricing: { prompt: '0.000003', completion: '0.000015' },
        },
        { id: 'llama3.1:8b' },
      ],
    });
    assert.equal(parsed.data.length, 2);
    assert.equal(parsed.data[0]?.pricing?.prompt, '0.000003');
    assert.equal(parsed.data[1]?.context_length, undefined);
  });
});
