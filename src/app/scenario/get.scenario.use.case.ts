import { z } from 'zod';
import { type ProjectionScenario } from '../../domain/scenario/projection.scenario.entity.ts';
import { ScenarioNotFoundError } from '../../domain/scenario/scenario.not.found.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type ScenarioRepository } from './scenario.repository.port.ts';
import { scenarioIdInputSchema } from './scenario.id.input.schema.ts';

/**
 * Caso de uso "carregar um cenario salvo" (spec 002, RF-35). So leitura;
 * `ScenarioNotFoundError` fora do escopo do usuario.
 */
export class GetScenarioUseCase {
  private readonly scenarios: ScenarioRepository;

  public constructor(scenarios: ScenarioRepository) {
    this.scenarios = scenarios;
  }

  public async execute(rawInput: unknown): Promise<ProjectionScenario> {
    const parsed = scenarioIdInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('carregar cenario', flat.fieldErrors, flat.formErrors);
    }

    const scenario = await this.scenarios.findById(parsed.data.userId, parsed.data.scenarioId);
    if (!scenario) {
      throw new ScenarioNotFoundError();
    }
    return scenario;
  }
}
