import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SaveScenarioUseCase } from '../../../src/app/scenario/save.scenario.use.case.ts';
import { ListScenariosUseCase } from '../../../src/app/scenario/list.scenarios.use.case.ts';
import { GetScenarioUseCase } from '../../../src/app/scenario/get.scenario.use.case.ts';
import { InvalidInputError } from '../../../src/app/shared/invalid.input.error.ts';
import { UserNotFoundError } from '../../../src/domain/user/user.not.found.error.ts';
import { ScenarioNotFoundError } from '../../../src/domain/scenario/scenario.not.found.error.ts';
import { User } from '../../../src/domain/user/user.entity.ts';
import { Cpf } from '../../../src/domain/shared/cpf.value.object.ts';
import { Email } from '../../../src/domain/shared/email.value.object.ts';
import { Phone } from '../../../src/domain/shared/phone.value.object.ts';
import { FakeUserRepository } from '../../../src/database/fake/user.repository.fake.ts';
import { FakeScenarioRepository } from '../../../src/database/fake/scenario.repository.fake.ts';
import { SequentialIdGenerator } from '../../support/sequential.id.generator.ts';

const makeUseCases = async () => {
  const users = new FakeUserRepository();
  const scenarios = new FakeScenarioRepository();
  await users.save(
    User.create({
      id: 'u1',
      cpf: Cpf.create('52998224725'),
      email: Email.create('marco@exemplo.com'),
      phone: Phone.create('11987654321'),
      name: 'Marco',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }),
  );
  return {
    scenarios,
    save: new SaveScenarioUseCase(scenarios, users, new SequentialIdGenerator('scn')),
    list: new ListScenariosUseCase(scenarios),
    get: new GetScenarioUseCase(scenarios),
  };
};

const input = (over: Record<string, unknown> = {}) => ({
  userId: 'u1',
  name: 'Mudanca de casa',
  adjustments: [
    {
      target: 'expense',
      mode: 'add',
      label: 'Aluguel novo',
      amountCents: 180_000,
      from: { year: 2026, month: 10 },
      to: { year: 2027, month: 2 },
    },
  ],
  ...over,
});

test('salva e depois carrega o cenario (RF-34, RF-35)', async () => {
  const { save, get } = await makeUseCases();

  const saved = await save.execute(input());
  assert.equal(saved.name, 'Mudanca de casa');
  assert.equal(saved.horizonMonths, 12); // default
  assert.equal(saved.adjustments.length, 1);

  const loaded = await get.execute({ userId: 'u1', scenarioId: saved.id });
  assert.equal(loaded.id, saved.id);
  assert.equal(loaded.adjustments[0]?.label, 'Aluguel novo');
});

test('lista os cenarios do usuario, ordenados por nome', async () => {
  const { save, list } = await makeUseCases();
  await save.execute(input({ name: 'Zulu' }));
  await save.execute(input({ name: 'Alfa' }));

  const names = (await list.execute({ userId: 'u1' })).map((s) => s.name);
  assert.deepEqual(names, ['Alfa', 'Zulu']);
});

test('get de cenario inexistente (ou de outro usuario) vira ScenarioNotFoundError', async () => {
  const { save, get } = await makeUseCases();
  const saved = await save.execute(input());

  await assert.rejects(get.execute({ userId: 'u1', scenarioId: 'nope' }), ScenarioNotFoundError);
  await assert.rejects(
    get.execute({ userId: 'outro', scenarioId: saved.id }),
    ScenarioNotFoundError,
  );
});

test('salvar para usuario inexistente vira UserNotFoundError', async () => {
  const { save } = await makeUseCases();
  await assert.rejects(save.execute(input({ userId: 'x' })), UserNotFoundError);
});

test('nome vazio vira InvalidInputError', async () => {
  const { save } = await makeUseCases();
  await assert.rejects(save.execute(input({ name: '   ' })), (error: unknown) => {
    assert.ok(error instanceof InvalidInputError);
    assert.equal(error.context, 'salvar cenario');
    return true;
  });
});
