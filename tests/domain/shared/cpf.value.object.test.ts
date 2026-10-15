import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { InvalidCpfError } from '../../../src/domain/shared/invalid.cpf.error.ts';

test('aceita CPF valido com e sem mascara e normaliza', () => {
  assert.equal(Cpf.create('529.982.247-25').digits, '52998224725');
  assert.equal(Cpf.create('52998224725').digits, '52998224725');
  assert.equal(Cpf.create('111.444.777-35').digits, '11144477735');
});

test('format devolve a mascara', () => {
  assert.equal(Cpf.create('52998224725').format(), '529.982.247-25');
});

test('rejeita tamanho errado, sequencia repetida e digito verificador invalido', () => {
  assert.throws(() => Cpf.create('123'), InvalidCpfError);
  assert.throws(() => Cpf.create('111.111.111-11'), InvalidCpfError);
  assert.throws(() => Cpf.create('00000000000'), InvalidCpfError);
  assert.throws(() => Cpf.create('529.982.247-24'), InvalidCpfError);
  assert.throws(() => Cpf.create('11144477730'), InvalidCpfError);
});

test('equals compara pelos digitos', () => {
  assert.equal(Cpf.create('529.982.247-25').equals(Cpf.create('52998224725')), true);
  assert.equal(Cpf.create('529.982.247-25').equals(Cpf.create('111.444.777-35')), false);
});
