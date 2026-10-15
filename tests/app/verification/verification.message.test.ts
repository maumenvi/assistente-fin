import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVerificationMessage } from '../../../src/app/verification/verification.message.ts';

test('e-mail: assunto e corpo carregam o codigo e o prazo', () => {
  const msg = buildVerificationMessage('email', '482913');
  assert.match(msg.subject, /482913/);
  assert.match(msg.body, /482913/);
  assert.match(msg.body, /15 minutos/);
  assert.match(msg.body, /e-mail/);
});

test('telefone: mesma estrutura, alvo diferente', () => {
  const msg = buildVerificationMessage('phone', '000111');
  assert.match(msg.body, /000111/);
  assert.match(msg.body, /telefone/);
});
