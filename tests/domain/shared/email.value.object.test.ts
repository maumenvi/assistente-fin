import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { InvalidEmailError } from '../../../src/domain/shared/invalid.email.error.ts';

test('aceita e-mail valido e normaliza (trim + minusculas)', () => {
  const email = Email.create('  Marco@Exemplo.COM  ');
  assert.equal(email.value, 'marco@exemplo.com');
});

test('equals compara pelo valor normalizado', () => {
  const a = Email.create('marco@exemplo.com');
  const b = Email.create('MARCO@EXEMPLO.COM');
  assert.ok(a.equals(b));
});

test('rejeita formatos invalidos', () => {
  for (const raw of ['', 'sem-arroba.com', 'sem-dominio@', '@sem-local.com', 'a b@c.com']) {
    assert.throws(() => Email.create(raw), InvalidEmailError, `deveria rejeitar "${raw}"`);
  }
});
