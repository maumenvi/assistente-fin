import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { presetCapabilities } from '../../../src/libs/llm/capability.presets.ts';
import { resolveCapabilities } from '../../../src/libs/llm/resolve.capabilities.ts';

describe('presetCapabilities', () => {
  it('reconhece familias conhecidas', () => {
    assert.equal(presetCapabilities('anthropic/claude-sonnet').contextWindow, 200_000);
    assert.equal(presetCapabilities('google/gemini-flash').contextWindow, 1_000_000);
    assert.equal(presetCapabilities('openai/gpt-4o-mini').tools, true);
    assert.equal(presetCapabilities('llama3.1:8b').tools, undefined);
    assert.deepEqual(presetCapabilities('modelo-desconhecido'), {});
    assert.equal(presetCapabilities('openrouter/auto').tools, true);
    assert.equal(presetCapabilities('gemini-3.8-flash').tools, true);
    assert.equal(presetCapabilities('gemini-3.8-flash').contextWindow, 1_000_000);
  });
});

describe('resolveCapabilities (precedencia: override > sonda > /models > presets > conservador)', () => {
  it('modelo desconhecido sem nenhuma fonte e conservador', () => {
    const caps = resolveCapabilities({ modelId: 'x/y' });
    assert.equal(caps.tools, false);
    assert.equal(caps.contextWindow, 8000);
    assert.equal(caps.verifiedAt, null);
  });

  it('familia conhecida herda o preset', () => {
    const caps = resolveCapabilities({ modelId: 'anthropic/claude-sonnet' });
    assert.equal(caps.tools, true);
    assert.equal(caps.promptCache, 'explicit');
  });

  it('a lista /models vence o preset', () => {
    const caps = resolveCapabilities({ modelId: 'anthropic/claude-sonnet', listing: { contextWindow: 123_456, tools: false } });
    assert.equal(caps.contextWindow, 123_456);
    assert.equal(caps.tools, false);
  });

  it('a sonda vence a lista e o preset, e registra quando verificou', () => {
    const caps = resolveCapabilities({
      modelId: 'anthropic/claude-sonnet',
      listing: { tools: true },
      probe: { tools: false, verifiedAt: '2026-10-22T12:00:00Z' },
    });
    assert.equal(caps.tools, false);
    assert.equal(caps.verifiedAt, '2026-10-22T12:00:00Z');
  });

  it('o override do usuario vence tudo, campo a campo', () => {
    const caps = resolveCapabilities({
      modelId: 'anthropic/claude-sonnet',
      probe: { tools: false },
      override: { tools: true },
    });
    assert.equal(caps.tools, true);
    assert.equal(caps.contextWindow, 200_000);
  });
});
