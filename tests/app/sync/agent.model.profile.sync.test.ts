import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isLocalOnlyModelProfile, isSyncableModelOrigin } from '../../../src/app/sync/is.local.only.sync.entity.ts';
import { toPairedUserProfile, type PairedUserProfile } from '../../../src/app/sync/paired.user.profile.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { type SyncAgentModelProfile } from '../../../src/domain/agent/model.profile.ts';

test('isLocalOnlyModelProfile e isSyncableModelOrigin classificam corretamente origens (spec 039, FR-007)', () => {
  assert.equal(isLocalOnlyModelProfile({ origin: 'openai_compat_local' }), true);
  assert.equal(isLocalOnlyModelProfile({ origin: 'google' }), false);
  assert.equal(isLocalOnlyModelProfile({ origin: 'openrouter' }), false);

  assert.equal(isSyncableModelOrigin('google'), true);
  assert.equal(isSyncableModelOrigin('openrouter'), true);
  assert.equal(isSyncableModelOrigin('openai_compat_local'), false);
});

test('Perfis locais (Ollama) nunca sincronizam para o celular pareado (spec 039, FR-007)', () => {
  const dummyUser = User.fromPersistence({
    id: 'user-123',
    cpf: Cpf.create('52998224725'),
    email: Email.create('user@example.com'),
    phone: Phone.create('11999998888'),
    name: 'Marco Test',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    emailVerifiedAt: null,
    phoneVerifiedAt: null,
    passwordHash: null,
    recoveryKeyHash: null,
    telegramChatId: null,
    defaultAccountId: null,
    lowBalanceThresholdCents: null,
  });

  const rawProfiles = [
    { id: 'main', role: 'main' as const, origin: 'google' as const, baseUrl: 'https://gemini.api', model: 'gemini-1.5-pro', apiKey: 'aiza-key', enabled: true },
    { id: 'fast', role: 'fast' as const, origin: 'openrouter' as const, baseUrl: 'https://openrouter.ai', model: 'openrouter/auto', apiKey: 'sk-or-key', enabled: true },
    { id: 'fallback', role: 'fallback' as const, origin: 'openai_compat_local' as const, baseUrl: 'http://localhost:11434', model: 'qwen2.5:latest', enabled: true },
  ];

  // Filtragem que o SyncHub aplica antes de enviar no perfil pareado
  const syncableProfiles: SyncAgentModelProfile[] = rawProfiles
    .filter((p) => !isLocalOnlyModelProfile(p) && isSyncableModelOrigin(p.origin))
    .map((p) => ({
      id: p.id,
      role: p.role,
      origin: p.origin as 'google' | 'openrouter',
      baseUrl: p.baseUrl,
      model: p.model,
      apiKey: p.apiKey,
      enabled: p.enabled,
    }));

  const paired = toPairedUserProfile(dummyUser, syncableProfiles);

  assert.ok(paired.agentProfiles);
  assert.equal(paired.agentProfiles.length, 2);

  // Somente Google AI e OpenRouter foram empacotados
  const origins = paired.agentProfiles.map((p) => p.origin);
  assert.deepEqual(origins, ['google', 'openrouter']);
  assert.ok(!origins.includes('openai_compat_local' as any));

  // Chaves para o celular funcionar imediatamente
  assert.equal(paired.agentProfiles?.[0]?.apiKey, 'aiza-key');
  assert.equal(paired.agentProfiles?.[1]?.apiKey, 'sk-or-key');
});
