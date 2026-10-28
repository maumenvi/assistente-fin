import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { makeConversationTitle } from '../../../src/domain/agent/make.conversation.title.ts';

describe('makeConversationTitle', () => {
  it('mantem textos de ate 60 caracteres', () => {
    const text = 'a'.repeat(60);
    assert.equal(makeConversationTitle(text), text);
    assert.equal(makeConversationTitle('a'.repeat(59)), 'a'.repeat(59));
  });

  it('trunca acima de 60 caracteres, com reticencias dentro do limite', () => {
    const title = makeConversationTitle('a'.repeat(61));
    assert.equal(title.length, 60);
    assert.ok(title.endsWith('…'));
  });

  it('colapsa quebras de linha e espacos', () => {
    assert.equal(makeConversationTitle('  Quanto gastei\n\n com   mercado?  '), 'Quanto gastei com mercado?');
  });

  it('texto vazio vira "Nova conversa"', () => {
    assert.equal(makeConversationTitle('  \n '), 'Nova conversa');
  });
});
