import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { InvalidPhoneError } from '../../../src/domain/shared/invalid.phone.error.ts';

test('normaliza celular com mascara, sem mascara e com +55 para E.164', () => {
  assert.equal(Phone.create('(11) 98765-4321').value, '+5511987654321');
  assert.equal(Phone.create('11987654321').value, '+5511987654321');
  assert.equal(Phone.create('+55 11 98765-4321').value, '+5511987654321');
  assert.equal(Phone.create('5511987654321').value, '+5511987654321');
});

test('aceita fixo (8 digitos, sem exigir 9 na frente)', () => {
  assert.equal(Phone.create('(11) 3265-4321').value, '+551132654321');
});

test('equals compara pelo valor normalizado', () => {
  const a = Phone.create('11987654321');
  const b = Phone.create('+55 (11) 98765-4321');
  assert.ok(a.equals(b));
});

test('format devolve numero com mascara', () => {
  assert.equal(Phone.create('11987654321').format(), '(11) 98765-4321');
  assert.equal(Phone.create('1132654321').format(), '(11) 3265-4321');
});

test('rejeita numeros invalidos', () => {
  const invalid = [
    '',
    '123',
    '119876543210',
    '01987654321', // DDD 01 nao existe
    '11887654321', // 9 digitos sem comecar com 9
  ];
  for (const raw of invalid) {
    assert.throws(() => Phone.create(raw), InvalidPhoneError, `deveria rejeitar "${raw}"`);
  }
});
