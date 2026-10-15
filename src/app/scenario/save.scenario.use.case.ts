import { z } from 'zod';
import { ProjectionScenario } from '../../domain/scenario/projection.scenario.entity.ts';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { type UserRepository } from '../user/user.repository.port.ts';
import { type ScenarioRepository } from './scenario.repository.port.ts';
import { saveScenarioInputSchema } from './save.scenario.input.schema.ts';
import { toScenarioAdjustment } from './to.scenario.adjustment.ts';

/**
 * Caso de uso "salvar cenario" (spec 002, RF-34).
 *
 * Persiste a definicao do cenario (nome + ajustes + horizonte) para reabrir depois. Nao
 * simula nem aplica nada, e nao exige verificacao (nao cria dado financeiro).
 */
export class SaveScenarioUseCase {
  private readonly scenarios: ScenarioRepository;
  private readonly users: UserRepository;
  private readonly ids: IdGenerator;

  public constructor(scenarios: ScenarioRepository, users: UserRepository, ids: IdGenerator) {
    this.scenarios = scenarios;
    this.users = users;
    this.ids = ids;
  }

  public async execute(rawInput: unknown): Promise<ProjectionScenario> {
    const parsed = saveScenarioInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('salvar cenario', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const user = await this.users.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError();
    }

    const scenario = ProjectionScenario.create({
      id: this.ids.next(),
      userId: input.userId,
      name: input.name,
      adjustments: input.adjustments.map(toScenarioAdjustment),
      horizonMonths: input.horizonMonths,
    });

    await this.scenarios.save(scenario);
    return scenario;
  }
}
