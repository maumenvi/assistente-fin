import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FakeDatabase } from '../../../src/database/fake/fake.database.ts';
import { type UserNotification } from '../../../src/domain/user-notification/user.notification.entity.ts';
import { UserNotificationNotFoundError } from '../../../src/domain/user-notification/user.notification.not.found.error.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { EmitUserNotificationUseCase } from '../../../src/app/user-notification/emit.user.notification.use.case.ts';
import { ListUserNotificationsUseCase } from '../../../src/app/user-notification/list.user.notifications.use.case.ts';
import { MarkUserNotificationReadUseCase } from '../../../src/app/user-notification/mark.user.notification.read.use.case.ts';
import { ClaimUserNotificationDeliveryUseCase } from '../../../src/app/user-notification/claim.user.notification.delivery.use.case.ts';
import { CountUnreadUserNotificationsUseCase } from '../../../src/app/user-notification/count.unread.user.notifications.use.case.ts';

/** Relogio controlavel e ids sequenciais: os casos de uso ficam deterministicos. */
function setup() {
  const database = new FakeDatabase();
  let now = new Date('2026-10-01T12:00:00Z');
  let seq = 0;
  const clock = { now: () => now };
  const ids = { next: () => `n${++seq}` };
  const delivered: UserNotification[] = [];
  const delivery = { deliver: (n: UserNotification) => void delivered.push(n) };
  return {
    database,
    delivered,
    advance: (ms: number) => {
      now = new Date(now.getTime() + ms);
    },
    emit: new EmitUserNotificationUseCase(database, ids, clock, delivery),
    list: new ListUserNotificationsUseCase(database),
    markRead: new MarkUserNotificationReadUseCase(database, clock),
    claim: new ClaimUserNotificationDeliveryUseCase(database, clock),
    countUnread: new CountUnreadUserNotificationsUseCase(database),
  };
}

test('emit: persiste e depois entrega uma vez a entidade salva', async () => {
  const s = setup();
  const n = await s.emit.execute({ userId: 'u1', source: 'mcp', title: 'Gasto', message: ' R$ 42,90 ' });
  assert.equal(n.message, 'R$ 42,90');
  assert.equal(n.isPendingDelivery, true);
  assert.equal((await s.database.userNotifications.findById('u1', n.id))?.title, 'Gasto');
  assert.equal(s.delivered.length, 1);
  assert.equal(s.delivered[0]?.id, n.id);
});

test('emit: entrega que lanca nao derruba a emissao', async () => {
  const database = new FakeDatabase();
  const emit = new EmitUserNotificationUseCase(
    database,
    { next: () => 'x1' },
    { now: () => new Date('2026-10-01T12:00:00Z') },
    {
      deliver: () => {
        throw new Error('toast quebrado');
      },
    },
  );
  const n = await emit.execute({ userId: 'u1', source: 'mcp', message: 'oi' });
  assert.ok(await database.userNotifications.findById('u1', n.id));
});

test('emit: entrada invalida -> InvalidInputError', async () => {
  const s = setup();
  await assert.rejects(s.emit.execute({ userId: 'u1', source: 'mcp', message: '   ' }), InvalidInputError);
  await assert.rejects(s.emit.execute({ userId: 'u1', source: 'MCP', message: 'oi' }), InvalidInputError);
  await assert.rejects(s.emit.execute({ userId: 'u1', source: 'mcp', message: 'x'.repeat(501) }), InvalidInputError);
  await assert.rejects(s.emit.execute({ userId: 'u1', source: 'mcp', message: 'oi', title: 'x'.repeat(101) }), InvalidInputError);
});

test('emit: acima de 10 MCP no minuto nasce suprimida, mas ainda e entregue e salva (RF-9a)', async () => {
  const s = setup();
  for (let i = 0; i < 10; i++) {
    const n = await s.emit.execute({ userId: 'u1', source: 'mcp', message: `m${i}` });
    assert.equal(n.isPendingDelivery, true, `a ${i + 1}a ainda deve ser exibida`);
    s.advance(1_000);
  }
  const eleventh = await s.emit.execute({ userId: 'u1', source: 'mcp', message: 'm10' });
  assert.equal(eleventh.isPendingDelivery, false);
  assert.equal(eleventh.deliveredAt?.getTime(), eleventh.createdAt.getTime());
  assert.equal(s.delivered.length, 11);
  assert.equal((await s.list.execute({ userId: 'u1', pageSize: 100 })).total, 11);
});

test('emit: depois de 60 s sem emissoes volta a exibir; outra origem e outro usuario nao contam', async () => {
  const s = setup();
  for (let i = 0; i < 10; i++) await s.emit.execute({ userId: 'u1', source: 'mcp', message: `m${i}` });
  const otherUser = await s.emit.execute({ userId: 'u2', source: 'mcp', message: 'x' });
  assert.equal(otherUser.isPendingDelivery, true);
  const capture = await s.emit.execute({ userId: 'u1', source: 'mobile-capture', message: 'c' });
  assert.equal(capture.isPendingDelivery, true, 'origem sem limite nunca e suprimida');
  s.advance(60_001);
  const later = await s.emit.execute({ userId: 'u1', source: 'mcp', message: 'depois' });
  assert.equal(later.isPendingDelivery, true);
});

test('list: devolve pagina com total, hasMore e nextPage, mais recentes primeiro', async () => {
  const s = setup();
  for (let i = 0; i < 3; i++) {
    await s.emit.execute({ userId: 'u1', source: 'mobile-capture', message: `m${i}` });
    s.advance(1_000);
  }
  const first = await s.list.execute({ userId: 'u1', page: 1, pageSize: 2 });
  assert.deepEqual(first.items.map((n) => n.message), ['m2', 'm1']);
  assert.deepEqual([first.page, first.pageSize, first.total, first.hasMore, first.nextPage], [1, 2, 3, true, 2]);
  const last = await s.list.execute({ userId: 'u1', page: 2, pageSize: 2 });
  assert.deepEqual([last.items.length, last.hasMore, last.nextPage], [1, false, null]);
  await assert.rejects(s.list.execute({ userId: 'u1', pageSize: 101 }), InvalidInputError);
});

test('markRead: idempotente; id de outro usuario -> UserNotificationNotFoundError', async () => {
  const s = setup();
  const n = await s.emit.execute({ userId: 'u1', source: 'mcp', message: 'oi' });
  await s.markRead.execute({ userId: 'u1', id: n.id });
  const firstRead = (await s.database.userNotifications.findById('u1', n.id))?.readAt;
  s.advance(5_000);
  await s.markRead.execute({ userId: 'u1', id: n.id });
  assert.equal((await s.database.userNotifications.findById('u1', n.id))?.readAt?.getTime(), firstRead?.getTime());
  await assert.rejects(s.markRead.execute({ userId: 'u2', id: n.id }), UserNotificationNotFoundError);
});

test('claim: devolve so as pendentes nao lidas, uma vez; as lidas viram entregues sem voltar', async () => {
  const s = setup();
  const a = await s.emit.execute({ userId: 'u1', source: 'mcp', message: 'a' });
  const b = await s.emit.execute({ userId: 'u1', source: 'mcp', message: 'b' });
  await s.markRead.execute({ userId: 'u1', id: b.id });
  const claimed = await s.claim.execute({ userId: 'u1' });
  assert.deepEqual(claimed.map((n) => n.id), [a.id]);
  assert.equal((await s.database.userNotifications.findById('u1', b.id))?.isPendingDelivery, false);
  assert.deepEqual(await s.claim.execute({ userId: 'u1' }), []);
});

test('claim: respeita os ids', async () => {
  const s = setup();
  const a = await s.emit.execute({ userId: 'u1', source: 'mcp', message: 'a' });
  await s.emit.execute({ userId: 'u1', source: 'mcp', message: 'b' });
  assert.deepEqual((await s.claim.execute({ userId: 'u1', ids: [a.id] })).map((n) => n.id), [a.id]);
});

test('countUnread: conta as nao lidas do usuario', async () => {
  const s = setup();
  const a = await s.emit.execute({ userId: 'u1', source: 'mcp', message: 'a' });
  await s.emit.execute({ userId: 'u1', source: 'mcp', message: 'b' });
  await s.emit.execute({ userId: 'u2', source: 'mcp', message: 'c' });
  await s.markRead.execute({ userId: 'u1', id: a.id });
  assert.deepEqual(await s.countUnread.execute({ userId: 'u1' }), { count: 1 });
});
