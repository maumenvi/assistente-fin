import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { describeConnectionReport } from '../../../../src/app/agent/setup/describe.connection.report.ts';
import { isAllowedExternalUrl } from '../../../../src/app/agent/guide/is.allowed.external.url.ts';
import { type ConnectionReport } from '../../../../src/domain/agent/connection/connection.report.ts';
import { type ConnectionStepId } from '../../../../src/domain/agent/connection/connection.step.id.ts';
import { type ConnectionStepStatus } from '../../../../src/domain/agent/connection/connection.step.status.ts';
import { PROVIDERS } from '../../../../src/domain/agent/provider/provider.catalog.ts';
import { PROVIDER_IDS } from '../../../../src/domain/agent/provider/provider.id.ts';

const CODES: readonly [ConnectionStepId, ConnectionStepStatus, string, Record<string, string | number>?][] = [
  ['reach', 'ok', 'reach.ok'], ['reach', 'failed', 'reach.offline'], ['reach', 'failed', 'reach.timeout'], ['reach', 'failed', 'reach.local_down'],
  ['key', 'ok', 'key.ok', { remainingUsd: 4.5 }], ['key', 'skipped', 'key.not_needed'], ['key', 'failed', 'key.missing'], ['key', 'failed', 'key.invalid', { looksLike: 'Google AI' }],
  ['key', 'failed', 'key.expired'], ['key', 'failed', 'key.no_credit'], ['key', 'warn', 'key.expiring', { days: 2 }], ['key', 'warn', 'key.looks_like_other', { looksLike: 'Google AI' }],
  ['model', 'ok', 'model.ok', { model: 'm' }], ['model', 'warn', 'model.default_replaced', { model: 'm' }], ['model', 'failed', 'model.not_found', { model: 'x', suggestion: 'y' }], ['model', 'failed', 'model.none_installed', { command: 'ollama pull qwen3:8b' }],
  ['tools', 'ok', 'tools.ok'], ['tools', 'ok', 'tools.not_required'], ['tools', 'failed', 'tools.stream_incompatible', { model: 'x', stage: 'chunk_invalido' }], ['tools', 'warn', 'tools.unsupported', { model: 'x', suggestion: 'y' }],
  ['context', 'ok', 'context.ok', { tokens: 16384 }], ['context', 'warn', 'context.short', { tokens: 8192 }], ['context', 'failed', 'context.too_small', { tokens: 4096 }], ['context', 'warn', 'context.unknown'],
  ['context', 'skipped', 'context.skipped'],
];

const reportOf = (steps: ConnectionReport['steps']): ConnectionReport => ({ ok: true, canSave: true, steps, model: null, capabilities: null, detected: { contextTokens: null, installedModels: [], keyInfo: null } });

describe('describeConnectionReport', () => {
  it('todo codigo tem titulo e texto em portugues, para todo provedor', () => {
    for (const provider of [...PROVIDER_IDS, 'custom' as const]) {
      for (const [id, status, code, detail] of CODES) {
        const [step] = describeConnectionReport(reportOf([{ id, status, code, ...(detail ? { detail } : {}) }]), provider);
        assert.ok((step?.title ?? '').length > 3, `${provider} ${code}`);
        if (status !== 'ok' || code === 'key.ok') assert.ok((step?.detail ?? '').length > 3, `${provider} ${code} detalhe`);
      }
    }
  });

  it('textos exigidos pela spec', () => {
    const one = (code: string, status: ConnectionStepStatus, id: ConnectionStepId, detail?: Record<string, string | number>, provider: 'openrouter' | 'ollama' = 'openrouter') =>
      describeConnectionReport(reportOf([{ id, status, code, ...(detail ? { detail } : {}) }]), provider)[0];
    assert.match(one('key.invalid', 'failed', 'key')?.detail ?? '', /Gere uma nova/);
    assert.equal(one('key.invalid', 'failed', 'key')?.action?.kind, 'guide');
    assert.match(one('key.no_credit', 'failed', 'key')?.detail ?? '', /crédito acabou/);
    assert.equal(one('key.no_credit', 'failed', 'key')?.action?.kind, 'link');
    const tools = one('tools.unsupported', 'warn', 'tools', { model: 'x/y', suggestion: 'openrouter/auto' });
    assert.match(tools?.detail ?? '', /x\/y não sabe consultar seus dados.*openrouter\/auto/);
    const ctx = one('context.too_small', 'failed', 'context', { tokens: 4096 }, 'ollama');
    assert.match(ctx?.detail ?? '', /4 mil tokens.*pelo menos 8 mil.*ideal 16 mil/);
    assert.deepEqual(ctx?.action, { label: 'Copiar o comando', kind: 'command', target: 'OLLAMA_CONTEXT_LENGTH=16384 ollama serve' });
    assert.notEqual(one('reach.offline', 'failed', 'reach')?.title, one('key.invalid', 'failed', 'key')?.title);
    assert.match(one('reach.offline', 'failed', 'reach')?.detail ?? '', /não é problema da chave/);
  });

  it('nenhuma chave aparece (sem sk-/AIza), e todo link de acao e https de host permitido', () => {
    const hosts = Object.values(PROVIDERS).flatMap((p) => p.allowedHosts);
    for (const provider of PROVIDER_IDS) {
      for (const [id, status, code, detail] of CODES) {
        const [step] = describeConnectionReport(reportOf([{ id, status, code, ...(detail ? { detail } : {}) }]), provider);
        assert.ok(!/sk-[\w-]{6,}|AIza[\w-]{10,}/.test(`${step?.title} ${step?.detail}`));
        if (step?.action?.kind === 'link') assert.ok(isAllowedExternalUrl(step.action.target, hosts), step.action.target);
      }
    }
  });

  it('mesmo relatorio => mesmo texto (funcao pura)', () => {
    const r = reportOf([{ id: 'key', status: 'failed', code: 'key.invalid' }]);
    assert.deepEqual(describeConnectionReport(r, 'google'), describeConnectionReport(r, 'google'));
  });
});
