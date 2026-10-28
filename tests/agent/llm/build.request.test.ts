import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CONSERVATIVE_CAPABILITIES } from '../../../src/domain/agent/conservative.capabilities.ts';
import { type ModelCapabilities } from '../../../src/domain/agent/model.capabilities.ts';
import { buildRequestBody } from '../../../src/libs/llm/openai-compat/build.request.ts';

const caps: ModelCapabilities = { ...CONSERVATIVE_CAPABILITIES, tools: true, structuredOutput: true };
const tool = { name: 'query_transactions', description: 'consulta', inputSchema: { type: 'object', properties: {} } };

describe('buildRequestBody por origem (spec 035)', () => {
  const request = { system: 's', messages: [], tools: [tool] };
  it('OpenRouter com ferramentas pede provider.require_parameters; sem ferramentas ou outra origem, nao', () => {
    assert.deepEqual(buildRequestBody({ model: 'm', includeUsage: true, capabilities: caps, request, origin: 'openrouter' })['provider'], { require_parameters: true });
    assert.equal(buildRequestBody({ model: 'm', includeUsage: true, capabilities: caps, request: { system: 's', messages: [] }, origin: 'openrouter' })['provider'], undefined);
    assert.equal(buildRequestBody({ model: 'm', includeUsage: true, capabilities: caps, request, origin: 'google' })['provider'], undefined);
  });
  it('Google nao recebe o campo `usage` (so do OpenRouter), mas pede o uso no stream', () => {
    const google = buildRequestBody({ model: 'gemini-3.8-flash', includeUsage: true, capabilities: caps, request, origin: 'google' });
    assert.equal(google['usage'], undefined);
    assert.deepEqual(google['stream_options'], { include_usage: true });
    assert.deepEqual(buildRequestBody({ model: 'm', includeUsage: true, capabilities: caps, request, origin: 'openrouter' })['usage'], { include: true });
  });
});

describe('buildRequestBody', () => {
  it('mensagens: system, user, assistant com ferramentas e resultado da ferramenta', () => {
    const body = buildRequestBody({
      model: 'm',
      includeUsage: false,
      capabilities: caps,
      request: {
        system: 'sys',
        messages: [
          { role: 'user', content: [{ type: 'text', text: 'oi' }] },
          { role: 'assistant', content: [], toolCalls: [{ id: 'c1', name: 'q', args: { a: 1 } }] },
          { role: 'tool', toolCallId: 'c1', content: '<dados>x</dados>' },
        ],
      },
    });
    assert.deepEqual(body['messages'], [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'oi' },
      { role: 'assistant', content: null, tool_calls: [{ id: 'c1', type: 'function', function: { name: 'q', arguments: '{"a":1}' } }] },
      { role: 'tool', tool_call_id: 'c1', content: '<dados>x</dados>' },
    ]);
    assert.equal(body['stream'], true);
    assert.equal(body['temperature'], 0);
  });

  it('inclui tools e tool_choice auto so quando o modelo suporta', () => {
    const request = { system: 's', messages: [], tools: [tool] };
    const withTools = buildRequestBody({ model: 'm', includeUsage: false, capabilities: caps, request });
    assert.deepEqual(withTools['tools'], [{ type: 'function', function: { name: 'query_transactions', description: 'consulta', parameters: tool.inputSchema } }]);
    assert.equal(withTools['tool_choice'], 'auto');
    const without = buildRequestBody({ model: 'm', includeUsage: false, capabilities: CONSERVATIVE_CAPABILITIES, request });
    assert.equal('tools' in without, false);
    assert.equal('tool_choice' in without, false);
  });

  it('toolChoice none e repassado; sem ferramentas nao ha tools', () => {
    const body = buildRequestBody({ model: 'm', includeUsage: false, capabilities: caps, request: { system: 's', messages: [], tools: [tool], toolChoice: 'none' } });
    assert.equal(body['tool_choice'], 'none');
    const empty = buildRequestBody({ model: 'm', includeUsage: false, capabilities: caps, request: { system: 's', messages: [], tools: [] } });
    assert.equal('tools' in empty, false);
  });

  it('uso so e pedido quando includeUsage', () => {
    const request = { system: 's', messages: [] };
    const on = buildRequestBody({ model: 'm', includeUsage: true, capabilities: caps, request });
    assert.deepEqual(on['stream_options'], { include_usage: true });
    assert.deepEqual(on['usage'], { include: true });
    const off = buildRequestBody({ model: 'm', includeUsage: false, capabilities: caps, request });
    assert.equal('stream_options' in off, false);
    assert.equal('usage' in off, false);
  });

  it('saida estruturada exige structuredOutput', () => {
    const request = { system: 's', messages: [], output: { name: 'intent', schema: { type: 'object' } } };
    const on = buildRequestBody({ model: 'm', includeUsage: false, capabilities: caps, request });
    assert.deepEqual(on['response_format'], { type: 'json_schema', json_schema: { name: 'intent', strict: true, schema: { type: 'object' } } });
    const off = buildRequestBody({ model: 'm', includeUsage: false, capabilities: CONSERVATIVE_CAPABILITIES, request });
    assert.equal('response_format' in off, false);
  });

  it('max_tokens e temperatura explicitos', () => {
    const body = buildRequestBody({ model: 'm', includeUsage: false, capabilities: caps, request: { system: 's', messages: [], maxOutputTokens: 256, temperature: 0.3 } });
    assert.equal(body['max_tokens'], 256);
    assert.equal(body['temperature'], 0.3);
  });

  it('imagem vira image_url com data URI e texto+imagem vira lista de partes', () => {
    const body = buildRequestBody({
      model: 'm', includeUsage: false, capabilities: caps,
      request: { system: 's', messages: [{ role: 'user', content: [{ type: 'text', text: 'olhe' }, { type: 'image', mediaType: 'image/png', dataBase64: 'QUJD' }] }] },
    });
    const user = (body['messages'] as Record<string, unknown>[])[1];
    assert.deepEqual(user?.['content'], [{ type: 'text', text: 'olhe' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,QUJD' } }]);
  });

  it('reinjeta reasoning_details do providerState na mensagem do assistente', () => {
    const body = buildRequestBody({
      model: 'm', includeUsage: false, capabilities: caps,
      request: { system: 's', messages: [{ role: 'assistant', content: [{ type: 'text', text: 'x' }], providerState: { reasoning_details: [{ t: 1 }] } }] },
    });
    assert.deepEqual((body['messages'] as Record<string, unknown>[])[1]?.['reasoning_details'], [{ t: 1 }]);
  });

  it('nunca carrega cabecalho de autorizacao no corpo', () => {
    const body = buildRequestBody({ model: 'm', includeUsage: true, capabilities: caps, request: { system: 's', messages: [] } });
    assert.equal(JSON.stringify(body).toLowerCase().includes('authorization'), false);
  });
});
