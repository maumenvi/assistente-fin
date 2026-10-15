import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseWalletNotification } from '../../../src/domain/capture/parse.wallet.notification.ts';
import { type WalletNotification } from '../../../src/domain/capture/wallet.notification.ts';
import { walletNotificationPayloadSchema } from '../../../src/app/capture/wallet.notification.payload.schema.ts';

/** Notificacoes do Google Wallet (spec 022, T130/T131). */
const fixtures = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../../fixtures/wallet/notifications.json'), 'utf8'),
) as { cases: { name: string; payload: WalletNotification; expected: Record<string, unknown> }[] };

function localDate(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getFullYear())}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

for (const { name, payload, expected } of fixtures.cases) {
  test(`wallet: ${name}`, () => {
    const { dedupKey, date, ...rest } = parseWalletNotification(payload);
    assert.deepEqual(rest, expected);
    assert.match(dedupKey ?? '', /^wallet:[0-9a-f]{16}$/);
    if (expected['amountCents'] !== undefined) assert.equal(date, localDate(payload.postTime));
  });
}

test('sem notificationKey (nativo antigo): mesma entrega = mesma dedupKey; outro postTime = outra', () => {
  const base = fixtures.cases[0]!.payload;
  assert.equal(parseWalletNotification(base).dedupKey, parseWalletNotification({ ...base }).dedupKey);
  assert.notEqual(parseWalletNotification(base).dedupKey, parseWalletNotification({ ...base, postTime: base.postTime + 1 }).dedupKey);
});

test('spec 027: com notificationKey + when, atualizar a notificacao (postTime/texto) NAO muda a dedupKey', () => {
  const base = { ...fixtures.cases[0]!.payload, notificationKey: '0|wallet|7|null|10123', when: fixtures.cases[0]!.payload.postTime - 1_000 };
  const updated = { ...base, postTime: base.postTime + 9_000, title: 'OUTRO TITULO' };
  assert.equal(parseWalletNotification(base).dedupKey, parseWalletNotification(updated).dedupKey);
});

test('payload de outro app e recusado na fronteira', () => {
  assert.equal(walletNotificationPayloadSchema.safeParse({ ...fixtures.cases[0]!.payload, packageName: 'com.whatsapp' }).success, false);
  assert.equal(walletNotificationPayloadSchema.safeParse(fixtures.cases[0]!.payload).success, true);
});
