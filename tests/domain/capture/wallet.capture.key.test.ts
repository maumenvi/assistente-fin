import { test } from 'node:test';
import assert from 'node:assert/strict';
import { walletCaptureKey } from '../../../src/domain/capture/wallet.capture.key.ts';

const base = {
  packageName: 'com.google.android.apps.walletnfcrel',
  notificationKey: '0|wallet|7|null|10123',
  when: 1_790_330_400_000,
  postTime: 1_790_330_401_000,
  title: 'Google Wallet',
  text: 'R$ 42,90',
};

test('walletCaptureKey: postagem e atualizacao da mesma compra (postTime e texto diferentes) = mesma chave', () => {
  const posted = walletCaptureKey(base, { amountCents: 4290 });
  const updated = walletCaptureKey({ ...base, postTime: base.postTime + 9_000, title: 'Mercado Dia' }, { amountCents: 4290, description: 'Mercado Dia' });
  assert.equal(posted, updated);
  assert.match(posted, /^wallet:[0-9a-f]{16}$/);
});

test('walletCaptureKey: outra compra (outro when) com a mesma chave de notificacao = outra chave', () => {
  assert.notEqual(walletCaptureKey(base, {}), walletCaptureKey({ ...base, when: base.when + 60_000 }, {}));
});

test('walletCaptureKey: sem when usa valor + estabelecimento normalizado', () => {
  const noWhen = { ...base, when: 0 };
  assert.equal(walletCaptureKey(noWhen, { amountCents: 4290, description: 'Padaria São João' }), walletCaptureKey({ ...noWhen, postTime: 1 }, { amountCents: 4290, description: ' padaria sao joao ' }));
  assert.notEqual(walletCaptureKey(noWhen, { amountCents: 4290 }), walletCaptureKey(noWhen, { amountCents: 4291 }));
});

test('walletCaptureKey: sem notificationKey (nativo antigo) cai na chave legada com postTime', () => {
  const legacy = { packageName: base.packageName, postTime: base.postTime, title: base.title, text: base.text };
  assert.notEqual(walletCaptureKey(legacy, {}), walletCaptureKey({ ...legacy, postTime: legacy.postTime + 1 }, {}));
  assert.equal(walletCaptureKey(legacy, {}), walletCaptureKey({ ...legacy }, {}));
});
