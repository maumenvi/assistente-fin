import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PreRegistration } from '../../../src/domain/pre-registration/pre.registration.entity.ts';
import { groupPossibleDuplicates } from '../../../src/domain/pre-registration/group.possible.duplicates.ts';

const at = (min: number) => new Date(Date.UTC(2026, 9, 1, 12, min));
const pre = (id: string, min: number, extra: Partial<Parameters<typeof PreRegistration.create>[0]> = {}) =>
  PreRegistration.create({ id, userId: 'u1', origin: 'wallet', createdAt: at(min), ...extra });
const ids = (groups: ReturnType<typeof groupPossibleDuplicates>) => groups.map((g) => g.members.map((m) => m.id));

test('par ligado por possibleDuplicateOf forma um grupo, mais antigo primeiro', () => {
  assert.deepEqual(ids(groupPossibleDuplicates([pre('b', 5, { possibleDuplicateOf: 'a' }), pre('a', 0)])), [['a', 'b']]);
});

test('trio encadeado (c aponta b, b aponta a) forma um unico grupo', () => {
  const group = groupPossibleDuplicates([pre('c', 9, { possibleDuplicateOf: 'b' }), pre('b', 5, { possibleDuplicateOf: 'a' }), pre('a', 0)]);
  assert.deepEqual(ids(group), [['a', 'b', 'c']]);
});

test('ponteiro para lancamento ou para alvo fora da lista nao agrupa', () => {
  assert.deepEqual(groupPossibleDuplicates([pre('b', 5, { possibleDuplicateOf: 'tx-1' }), pre('a', 0)]), []);
});

test('revisado ("sao diferentes") nao agrupa', () => {
  assert.deepEqual(groupPossibleDuplicates([pre('b', 5, { possibleDuplicateOf: 'a', duplicateReviewed: true }), pre('a', 0)]), []);
  assert.deepEqual(groupPossibleDuplicates([pre('b', 5, { possibleDuplicateOf: 'a' }), pre('a', 0, { duplicateReviewed: true })]), []);
});

test('dois grupos independentes: o do membro mais recente vem primeiro', () => {
  const groups = groupPossibleDuplicates([
    pre('a2', 1, { possibleDuplicateOf: 'a1' }),
    pre('a1', 0),
    pre('b2', 20, { possibleDuplicateOf: 'b1' }),
    pre('b1', 10),
    pre('solta', 30),
  ]);
  assert.deepEqual(ids(groups), [['b1', 'b2'], ['a1', 'a2']]);
});
