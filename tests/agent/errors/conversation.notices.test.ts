import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { fallbackUsedNotice } from '../../../src/app/agent/errors/fallback.used.notice.ts';
import { noticeOfError } from '../../../src/app/agent/errors/notice.of.error.ts';
import { providerNameOfProfile } from '../../../src/app/agent/errors/provider.name.of.profile.ts';
import { CONSERVATIVE_CAPABILITIES } from '../../../src/domain/agent/conservative.capabilities.ts';
import { LlmAuthError } from '../../../src/domain/agent/errors/llm.auth.error.ts';
import { LlmKeyExpiredError } from '../../../src/domain/agent/errors/llm.key.expired.error.ts';
import { LlmQuotaError } from '../../../src/domain/agent/errors/llm.quota.error.ts';
import { LlmUnavailableError } from '../../../src/domain/agent/errors/llm.unavailable.error.ts';
import { type ModelProfile } from '../../../src/domain/agent/model.profile.ts';

const profile = (origin: ModelProfile['origin'], baseUrl: string): ModelProfile => ({ id: 'main', role: 'main', origin, baseUrl, model: 'm', keyRef: null, capabilities: CONSERVATIVE_CAPABILITIES, enabled: true });

describe('avisos de chave, credito e modelo alternativo (spec 035)', () => {
  it('LLM_AUTH => key_rejected com o nome do provedor, sem texto cru, com o botao da configuracao', () => {
    const n = noticeOfError(new LlmAuthError(), 'OpenRouter');
    assert.equal(n?.kind, 'key_rejected');
    assert.equal(n?.title, 'Sua chave do OpenRouter foi recusada');
    assert.match(n?.text ?? '', /OpenRouter não aceitou a chave.*Nada foi enviado ao modelo/);
    assert.deepEqual(n?.action, { label: 'Abrir configuração', route: '/assistente/configuracao' });
  });

  it('LLM_KEY_EXPIRED => key_expired; LLM_QUOTA => quota_exhausted', () => {
    assert.equal(noticeOfError(new LlmKeyExpiredError(), 'OpenRouter')?.kind, 'key_expired');
    assert.match(noticeOfError(new LlmKeyExpiredError(), 'OpenRouter')?.text ?? '', /validade longa/);
    const quota = noticeOfError(new LlmQuotaError(), 'Google AI (Gemini)');
    assert.equal(quota?.kind, 'quota_exhausted');
    assert.match(quota?.text ?? '', /Adicione saldo no Google AI \(Gemini\)/);
    assert.equal(quota?.action?.label, 'Abrir configuração');
  });

  it('outros erros nao viram aviso de chave', () => {
    assert.equal(noticeOfError(new LlmUnavailableError(), 'OpenRouter'), null);
    assert.equal(noticeOfError(new Error('x'), 'OpenRouter'), null);
  });

  it('fallback_used cita o modelo e so oferece "Ver configuração"', () => {
    const n = fallbackUsedNotice('gemini-3.8-flash');
    assert.equal(n.kind, 'fallback_used');
    assert.equal(n.text, 'Usei o modelo alternativo (gemini-3.8-flash) porque o principal falhou desta vez.');
    assert.equal(n.action?.label, 'Ver configuração');
    assert.equal(fallbackUsedNotice(null).text, 'Usei o modelo alternativo porque o principal falhou desta vez.');
  });

  it('nome do provedor a partir do perfil', () => {
    assert.equal(providerNameOfProfile(profile('openrouter', 'https://openrouter.ai/api/v1')), 'OpenRouter');
    assert.equal(providerNameOfProfile(profile('google', 'https://generativelanguage.googleapis.com/v1beta/openai')), 'Google AI (Gemini)');
    assert.equal(providerNameOfProfile(profile('openai_compat_local', 'http://localhost:8080/v1')), 'provedor');
    assert.equal(providerNameOfProfile(null), 'provedor');
  });
});
