import { z } from 'zod';
import { type ProjectionScenario } from '../../domain/scenario/projection.scenario.entity.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type ScenarioRepository } from './scenario.repository.port.ts';
import { listScenariosInputSchema } from './list.scenarios.input.schema.ts';

/** Caso de uso "listar cenarios salvos do usuario" (spec 002, RF-35). So leitura. */
export class ListScenariosUseCase {
  private readonly scenarios: ScenarioRepository;

  public constructor(scenarios: ScenarioRepository) {
    this.scenarios = scenarios;
  }

  public async execute(rawInput: unknown): Promise<ProjectionScenario[]> {
    const parsed = listScenariosInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('listar cenarios', flat.fieldErrors, flat.formErrors);
    }

    return this.scenarios.listByUser(parsed.data.userId);
  }
}
