import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseNfceQr } from '../../../src/libs/nfce/parse.nfce.qr.ts';
import { decodeNfceAccessKey } from '../../../src/libs/nfce/nfce.access.key.ts';

const fixture = (name: string) => readFileSync(new URL(`../../fixtures/nfce/qr/${name}`, import.meta.url), 'utf8').trim();

test('chave de acesso: UF, AAMM, CNPJ, modelo, serie, numero e digito verificador', () => {
  const key = decodeNfceAccessKey('35260912345678000195650010000123451123456788');
  assert.deepEqual(key, {
    key: '35260912345678000195650010000123451123456788',
    uf: 'SP',
    year: 2026,
    month: 9,
    cnpj: '12345678000195',
    model: '65',
    series: 1,
    number: 12345,
  });
  assert.equal(decodeNfceAccessKey('35260912345678000195650010000123451123456789'), null, 'DV errado');
});

test('QR online v2: link e chave; sem valor nem data (precisa consultar a SEFAZ)', () => {
  const url = fixture('sp.online.v2.txt');
  const draft = parseNfceQr(url);
  assert.ok(draft);
  assert.equal(draft.origin, 'nfce');
  assert.equal(draft.notes, url);
  assert.equal(draft.link, url);
  assert.equal(draft.dedupKey, '35260912345678000195650010000123451123456788');
  assert.equal(draft.amountCents, undefined);
  assert.equal(draft.confidence, 'low');
});

test('QR de contingencia v2: dia e valor vem no proprio QR', () => {
  const draft = parseNfceQr(fixture('mg.offline.v2.txt'));
  assert.equal(draft?.amountCents, 14530);
  assert.equal(draft?.date, '2026-09-24');
});

test('QR v3 e aceito; QR que nao e NFC-e ou com DV errado vira null', () => {
  assert.equal(parseNfceQr(fixture('rj.online.v3.txt'))?.dedupKey?.slice(0, 2), '33');
  assert.equal(parseNfceQr(fixture('not.nfce.txt')), null);
  assert.equal(parseNfceQr(fixture('invalid.dv.txt')), null);
  assert.equal(parseNfceQr('texto qualquer'), null);
});
