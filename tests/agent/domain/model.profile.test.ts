import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CONSERVATIVE_CAPABILITIES } from '../../../src/domain/agent/conservative.capabilities.ts';
import { MODEL_ROLES } from '../../../src/domain/agent/model.role.ts';
import { requiresCloudConsent } from '../../../src/domain/agent/requires.cloud.consent.ts';

describe('capacidades e consentimento', () => {
  it('modelo desconhecido e conservador: sem ferramentas, contexto pequeno, nunca verificado', () => {
    assert.equal(CONSERVATIVE_CAPABILITIES.tools, false);
    assert.equal(CONSERVATIVE_CAPABILITIES.contextWindow, 8000);
    assert.equal(CONSERVATIVE_CAPABILITIES.verifiedAt, null);
    assert.equal(CONSERVATIVE_CAPABILITIES.promptCache, 'none');
  });

  it('as capacidades conservadoras nao podem ser alteradas', () => {
    assert.throws(() => {
      (CONSERVATIVE_CAPABILITIES as { tools: boolean }).tools = true;
    }, TypeError);
  });

  it('papeis validos', () => {
    assert.ok(MODEL_ROLES.includes('main'));
    assert.ok(MODEL_ROLES.includes('fast'));
    assert.ok(MODEL_ROLES.includes('fallback'));
  });

  it('so a nuvem exige consentimento; o servidor local nunca', () => {
    assert.equal(requiresCloudConsent('openrouter'), true);
    assert.equal(requiresCloudConsent('google'), true);
    assert.equal(requiresCloudConsent('openai_compat_local'), false);
  });
});
