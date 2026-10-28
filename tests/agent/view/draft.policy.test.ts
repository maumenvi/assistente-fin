import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { clampDraft, MAX_DRAFT_CHARS, shouldClearDraft, shouldPersistDraft } from '../../../src/app/agent/view/draft.policy.ts';

describe('politica do rascunho do chat', () => {
  it('so guarda texto de verdade', () => {
    assert.equal(shouldPersistDraft('quanto gastei?'), true);
    assert.equal(shouldPersistDraft('   \n '), false);
    assert.equal(shouldPersistDraft(''), false);
  });

  it('limpa ao enviar ou quando o campo fica vazio; falha de envio mantem o texto', () => {
    assert.equal(shouldClearDraft({ sent: true, text: 'oi' }), true);
    assert.equal(shouldClearDraft({ sent: false, text: '' }), true);
    assert.equal(shouldClearDraft({ sent: false, text: 'ainda digitando' }), false);
  });

  it('corta no maximo guardado', () => {
    assert.equal(clampDraft('a'.repeat(MAX_DRAFT_CHARS + 50)).length, MAX_DRAFT_CHARS);
    assert.equal(clampDraft('curto'), 'curto');
  });
});
