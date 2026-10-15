import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type CaptureReceiptRepository } from '../../../src/app/pre-registration/capture.receipt.repository.port.ts';
import { CaptureReceipt } from '../../../src/domain/pre-registration/capture.receipt.entity.ts';

const at = (iso: string) => new Date(iso);
const receipt = (userId: string, key: string, pre: string, created = '2026-10-01T10:00:00Z') =>
  CaptureReceipt.create({ userId, captureKey: key, preRegistrationId: pre, createdAt: at(created) });

/** Suite de contrato do `CaptureReceiptRepository` (spec 027, T008). Usuarios `u1`/`u2` existem. */
export function runCaptureReceiptRepositoryContract(label: string, createRepository: () => CaptureReceiptRepository): void {
  test(`${label}: insertIfAbsent grava uma vez por chave e usuario`, async () => {
    const repo = createRepository();
    assert.equal(await repo.insertIfAbsent(receipt('u1', 'k1', 'p1')), true);
    assert.equal(await repo.insertIfAbsent(receipt('u1', 'k1', 'p2')), false);
    assert.equal((await repo.findByKey('u1', 'k1'))?.preRegistrationId, 'p1');
    assert.equal(await repo.insertIfAbsent(receipt('u2', 'k1', 'p3')), true, 'outro usuario, outra chave');
    assert.equal(await repo.findByKey('u2', 'nope'), null);
  });

  test(`${label}: insertIfAbsent concorrente -> exatamente um true`, async () => {
    const repo = createRepository();
    const results = await Promise.all([1, 2, 3].map((n) => repo.insertIfAbsent(receipt('u1', 'kc', `p${n}`))));
    assert.equal(results.filter(Boolean).length, 1);
  });

  test(`${label}: listByPreRegistration devolve todos os recibos do pre, do mais antigo ao mais novo (spec 028)`, async () => {
    const repo = createRepository();
    await repo.insertIfAbsent(receipt('u1', 'k2', 'p1', '2026-10-01T10:01:00Z'));
    await repo.insertIfAbsent(receipt('u1', 'k1', 'p1', '2026-10-01T10:00:00Z'));
    await repo.insertIfAbsent(receipt('u1', 'k3', 'p2'));
    await repo.insertIfAbsent(receipt('u2', 'k4', 'p1'));
    assert.deepEqual((await repo.listByPreRegistration('u1', 'p1')).map((r) => r.captureKey), ['k1', 'k2']);
    assert.deepEqual(await repo.listByPreRegistration('u1', 'nada'), []);
  });

  test(`${label}: save repontua o recibo para outro pre-registro (spec 028)`, async () => {
    const repo = createRepository();
    await repo.insertIfAbsent(receipt('u1', 'k1', 'p1'));
    const found = await repo.findByKey('u1', 'k1');
    await repo.save(found!.withPreRegistrationId('p9'));
    assert.equal((await repo.findByKey('u1', 'k1'))?.preRegistrationId, 'p9');
    assert.equal((await repo.listByPreRegistration('u1', 'p1')).length, 0);
  });

  test(`${label}: findByPreRegistration e save (resolucao e versao)`, async () => {
    const repo = createRepository();
    await repo.insertIfAbsent(receipt('u1', 'k1', 'p1'));
    const found = await repo.findByPreRegistration('u1', 'p1');
    assert.equal(found?.captureKey, 'k1');
    await repo.save(found!.withCaptureVersion('v1').resolve('approved', at('2026-10-01T11:00:00Z')));
    const saved = await repo.findByKey('u1', 'k1');
    assert.equal(saved?.resolution, 'approved');
    assert.equal(saved?.captureVersion, 'v1');
    assert.equal(saved?.resolvedAt?.toISOString(), '2026-10-01T11:00:00.000Z');
    assert.equal(await repo.findByPreRegistration('u2', 'p1'), null);
  });

  test(`${label}: purgeResolvedBefore apaga so os resolvidos antigos`, async () => {
    const repo = createRepository();
    await repo.insertIfAbsent(receipt('u1', 'old', 'p1'));
    await repo.insertIfAbsent(receipt('u1', 'new', 'p2'));
    await repo.insertIfAbsent(receipt('u1', 'pend', 'p3'));
    await repo.save((await repo.findByKey('u1', 'old'))!.resolve('discarded', at('2026-08-01T00:00:00Z')));
    await repo.save((await repo.findByKey('u1', 'new'))!.resolve('approved', at('2026-10-01T00:00:00Z')));
    assert.equal(await repo.purgeResolvedBefore('u1', at('2026-09-01T00:00:00Z')), 1);
    assert.equal(await repo.findByKey('u1', 'old'), null);
    assert.ok(await repo.findByKey('u1', 'new'));
    assert.ok(await repo.findByKey('u1', 'pend'), 'pendente nunca sai');
  });
}
