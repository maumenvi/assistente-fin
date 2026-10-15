import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type UserNotificationRepository } from '../../../src/app/user-notification/user.notification.repository.port.ts';
import { UserNotification } from '../../../src/domain/user-notification/user.notification.entity.ts';

const at = (iso: string) => new Date(iso);
const notification = (id: string, userId: string, createdAt: string, extra: { source?: string; suppressed?: boolean } = {}) =>
  UserNotification.create({ id, userId, source: extra.source ?? 'mcp', title: null, message: `m-${id}`, now: at(createdAt), suppressed: extra.suppressed });
const page = (p: number, size: number, unreadOnly = false) => ({ page: p, pageSize: size, unreadOnly });

/**
 * Suite de contrato do `UserNotificationRepository` (spec 013, T011): roda igual sobre o fake, o
 * Prisma e o SQLite. Os usuarios `u1`/`u2` precisam existir (as suites com FK semeiam antes).
 */
export function runUserNotificationRepositoryContract(label: string, createRepository: () => UserNotificationRepository): void {
  test(`${label}: save + findById no escopo do usuario`, async () => {
    const repo = createRepository();
    await repo.save(notification('n1', 'u1', '2026-10-01T10:00:00Z'));
    const found = await repo.findById('u1', 'n1');
    assert.equal(found?.message, 'm-n1');
    assert.equal(found?.source, 'mcp');
    assert.equal(found?.deliveredAt, null);
    assert.equal(await repo.findById('u2', 'n1'), null);
    assert.equal(await repo.findById('u1', 'nope'), null);
  });

  test(`${label}: save persiste readAt`, async () => {
    const repo = createRepository();
    const n = notification('n1', 'u1', '2026-10-01T10:00:00Z');
    await repo.save(n);
    await repo.save(n.markRead(at('2026-10-01T11:00:00Z')));
    assert.equal((await repo.findById('u1', 'n1'))?.readAt?.toISOString(), '2026-10-01T11:00:00.000Z');
  });

  test(`${label}: listByUser ordena por createdAt desc, pagina, conta total e filtra nao lidas`, async () => {
    const repo = createRepository();
    await repo.save(notification('a', 'u1', '2026-10-01T10:00:00Z'));
    await repo.save(notification('b', 'u1', '2026-10-01T12:00:00Z'));
    await repo.save(notification('c', 'u1', '2026-10-01T11:00:00Z').markRead(at('2026-10-01T13:00:00Z')));
    await repo.save(notification('x', 'u2', '2026-10-01T14:00:00Z'));

    const first = await repo.listByUser('u1', page(1, 2));
    assert.deepEqual(first.items.map((n) => n.id), ['b', 'c']);
    assert.equal(first.total, 3);
    const second = await repo.listByUser('u1', page(2, 2));
    assert.deepEqual(second.items.map((n) => n.id), ['a']);
    const unread = await repo.listByUser('u1', page(1, 20, true));
    assert.deepEqual(unread.items.map((n) => n.id), ['b', 'a']);
    assert.equal(unread.total, 2);
  });

  test(`${label}: claimUndelivered marca so as pendentes do usuario e nao repete`, async () => {
    const repo = createRepository();
    await repo.save(notification('a', 'u1', '2026-10-01T10:00:00Z'));
    await repo.save(notification('b', 'u1', '2026-10-01T11:00:00Z'));
    await repo.save(notification('s', 'u1', '2026-10-01T11:30:00Z', { suppressed: true }));
    await repo.save(notification('x', 'u2', '2026-10-01T12:00:00Z'));

    const now = at('2026-10-01T15:00:00Z');
    const claimed = await repo.claimUndelivered('u1', now);
    assert.deepEqual(claimed.map((n) => n.id).sort(), ['a', 'b']);
    assert.ok(claimed.every((n) => n.deliveredAt?.getTime() === now.getTime()));
    assert.equal((await repo.findById('u1', 'a'))?.deliveredAt?.toISOString(), now.toISOString());
    assert.deepEqual(await repo.claimUndelivered('u1', now), []);
    assert.equal((await repo.findById('u2', 'x'))?.deliveredAt, null);
  });

  test(`${label}: claimUndelivered respeita os ids`, async () => {
    const repo = createRepository();
    await repo.save(notification('a', 'u1', '2026-10-01T10:00:00Z'));
    await repo.save(notification('b', 'u1', '2026-10-01T11:00:00Z'));
    const claimed = await repo.claimUndelivered('u1', at('2026-10-01T15:00:00Z'), ['b']);
    assert.deepEqual(claimed.map((n) => n.id), ['b']);
    assert.equal((await repo.findById('u1', 'a'))?.deliveredAt, null);
  });

  test(`${label}: claimUndelivered concorrente devolve conjuntos disjuntos (exibir uma vez)`, async () => {
    const repo = createRepository();
    for (const id of ['a', 'b', 'c', 'd']) await repo.save(notification(id, 'u1', '2026-10-01T10:00:00Z'));
    const now = at('2026-10-01T15:00:00Z');
    const [one, two] = await Promise.all([repo.claimUndelivered('u1', now), repo.claimUndelivered('u1', now)]);
    const ids = [...one, ...two].map((n) => n.id).sort();
    assert.deepEqual(ids, ['a', 'b', 'c', 'd']);
  });

  test(`${label}: countUnread ignora lidas e outros usuarios`, async () => {
    const repo = createRepository();
    await repo.save(notification('a', 'u1', '2026-10-01T10:00:00Z'));
    await repo.save(notification('b', 'u1', '2026-10-01T11:00:00Z').markRead(at('2026-10-01T12:00:00Z')));
    await repo.save(notification('x', 'u2', '2026-10-01T10:00:00Z'));
    assert.equal(await repo.countUnread('u1'), 1);
    assert.equal(await repo.countUnread('u2'), 1);
  });

  test(`${label}: countBySourceSince filtra usuario, origem e createdAt >= since`, async () => {
    const repo = createRepository();
    await repo.save(notification('old', 'u1', '2026-10-01T09:59:59Z'));
    await repo.save(notification('a', 'u1', '2026-10-01T10:00:00Z'));
    await repo.save(notification('b', 'u1', '2026-10-01T10:00:30Z', { suppressed: true }));
    await repo.save(notification('m', 'u1', '2026-10-01T10:00:30Z', { source: 'mobile-capture' }));
    await repo.save(notification('x', 'u2', '2026-10-01T10:00:30Z'));
    assert.equal(await repo.countBySourceSince('u1', 'mcp', at('2026-10-01T10:00:00Z')), 2);
    assert.equal(await repo.countBySourceSince('u1', 'mobile-capture', at('2026-10-01T10:00:00Z')), 1);
  });
}
