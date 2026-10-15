import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planDailyReminder } from '../../../src/app/pre-registration/plan.daily.reminder.ts';

const settings = { enabled: true, time: '10:00', weekdaysOnly: true };

test('sem pendencias ou desligado: cancela (FR-030)', () => {
  assert.deepEqual(planDailyReminder(0, settings), { action: 'cancel' });
  assert.deepEqual(planDailyReminder(5, { ...settings, enabled: false }), { action: 'cancel' });
});

test('com pendencias: agenda nos dias uteis no horario configurado', () => {
  const plan = planDailyReminder(3, settings);
  assert.equal(plan.action, 'schedule');
  if (plan.action !== 'schedule') return;
  assert.equal(plan.hour, 10);
  assert.equal(plan.minute, 0);
  assert.deepEqual(plan.weekdays, [2, 3, 4, 5, 6]);
  assert.match(plan.body, /3 pendências/);
});

test('todos os dias quando weekdaysOnly = false; texto no singular e 99+', () => {
  const daily = planDailyReminder(1, { enabled: true, time: '08:30', weekdaysOnly: false });
  assert.equal(daily.action, 'schedule');
  if (daily.action !== 'schedule') return;
  assert.deepEqual(daily.weekdays, [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(daily.minute, 30);
  assert.match(daily.body, /1 pendência /);
  const many = planDailyReminder(150, settings);
  assert.ok(many.action === 'schedule' && many.body.includes('99+'));
});

test('horario fora do comercial volta ao padrao 10:00', () => {
  const plan = planDailyReminder(2, { enabled: true, time: '22:00', weekdaysOnly: true });
  assert.ok(plan.action === 'schedule' && plan.hour === 10);
});
