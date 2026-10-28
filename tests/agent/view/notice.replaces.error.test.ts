import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { noticeReplacesError } from '../../../src/app/agent/view/notice.replaces.error.ts';

describe('noticeReplacesError', () => {
  it('avisos de chave/credito substituem o texto generico; os demais nao', () => {
    for (const kind of ['key_rejected', 'key_expired', 'quota_exhausted'] as const) assert.equal(noticeReplacesError([{ type: 'notice', kind, text: 'x' }]), true, kind);
    for (const kind of ['fallback_used', 'truncated', 'offline'] as const) assert.equal(noticeReplacesError([{ type: 'notice', kind, text: 'x' }]), false, kind);
    assert.equal(noticeReplacesError([{ type: 'text', text: 'oi' }]), false);
  });
});
