import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UserNotification } from '../../../src/domain/user-notification/user.notification.entity.ts';
import { InvalidUserNotificationError } from '../../../src/domain/user-notification/invalid.user.notification.error.ts';

const NOW = new Date('2026-10-01T12:00:00Z');
const base = { id: 'n1', userId: 'u1', source: 'mcp', title: null, message: 'Gasto registrado', now: NOW };

test('UserNotification.create: apara mensagem e titulo e nasce pendente e nao lida', () => {
  const n = UserNotification.create({ ...base, title: '  Gasto  ', message: '  R$ 42,90  ' });
  assert.equal(n.title, 'Gasto');
  assert.equal(n.message, 'R$ 42,90');
  assert.equal(n.createdAt.getTime(), NOW.getTime());
  assert.equal(n.deliveredAt, null);
  assert.equal(n.readAt, null);
  assert.equal(n.isRead, false);
  assert.equal(n.isPendingDelivery, true);
});

test('UserNotification.create: titulo so com espacos vira nulo', () => {
  assert.equal(UserNotification.create({ ...base, title: '   ' }).title, null);
});

test('UserNotification.create: mensagem vazia ou acima de 500 e invalida', () => {
  assert.throws(() => UserNotification.create({ ...base, message: '   ' }), InvalidUserNotificationError);
  assert.throws(() => UserNotification.create({ ...base, message: 'x'.repeat(501) }), InvalidUserNotificationError);
  assert.equal(UserNotification.create({ ...base, message: 'x'.repeat(500) }).message.length, 500);
});

test('UserNotification.create: titulo acima de 100 e invalido', () => {
  assert.throws(() => UserNotification.create({ ...base, title: 'x'.repeat(101) }), InvalidUserNotificationError);
  assert.equal(UserNotification.create({ ...base, title: 'x'.repeat(100) }).title?.length, 100);
});

test('UserNotification.create: origem fora do formato e invalida', () => {
  assert.throws(() => UserNotification.create({ ...base, source: 'MCP' }), InvalidUserNotificationError);
  assert.throws(() => UserNotification.create({ ...base, source: '' }), InvalidUserNotificationError);
});

test('UserNotification.create: suprimida nasce ja entregue (RF-9a)', () => {
  const n = UserNotification.create({ ...base, suppressed: true });
  assert.equal(n.deliveredAt?.getTime(), NOW.getTime());
  assert.equal(n.isPendingDelivery, false);
});

test('UserNotification.markRead: idempotente, mantem o primeiro readAt', () => {
  const first = new Date('2026-10-01T13:00:00Z');
  const read = UserNotification.create(base).markRead(first);
  assert.equal(read.isRead, true);
  assert.equal(read.markRead(new Date('2026-10-02T00:00:00Z')).readAt?.getTime(), first.getTime());
});

test('UserNotification.markDelivered: idempotente, mantem o primeiro deliveredAt', () => {
  const first = new Date('2026-10-01T13:00:00Z');
  const delivered = UserNotification.create(base).markDelivered(first);
  assert.equal(delivered.isPendingDelivery, false);
  assert.equal(delivered.markDelivered(new Date('2026-10-02T00:00:00Z')).deliveredAt?.getTime(), first.getTime());
});

test('UserNotification.fromPersistence: reconstroi todos os campos', () => {
  const n = UserNotification.fromPersistence({
    id: 'n9',
    userId: 'u2',
    source: 'mobile-capture',
    title: 'Captura do celular',
    message: 'R$ 1,00',
    createdAt: NOW,
    deliveredAt: new Date('2026-10-01T12:00:01Z'),
    readAt: new Date('2026-10-01T12:00:02Z'),
  });
  assert.deepEqual(
    [n.id, n.userId, n.source, n.title, n.message, n.createdAt.toISOString(), n.deliveredAt?.toISOString(), n.readAt?.toISOString()],
    ['n9', 'u2', 'mobile-capture', 'Captura do celular', 'R$ 1,00', NOW.toISOString(), '2026-10-01T12:00:01.000Z', '2026-10-01T12:00:02.000Z'],
  );
});
