import { z } from 'zod';
import { type ProjectionScenario } from '../../domain/scenario/projection.scenario.entity.ts';
import { ScenarioNotFoundError } from '../../domain/scenario/scenario.not.found.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type ScenarioRepository } from './scenario.repository.port.ts';
import { scenarioIdInputSchema } from './scenario.id.input.schema.ts';

/**
 * Caso de uso "excluir cenario salvo" (spec 002, RF-36). Busca no escopo do usuario antes de
 * remover pra devolver `ScenarioNotFoundError`. Devolve o cenario removido.
 */
export class DeleteScenarioUseCase {
  private readonly scenarios: ScenarioRepository;

  public constructor(scenarios: ScenarioRepository) {
    this.scenarios = scenarios;
  }

  public async execute(rawInput: unknown): Promise<ProjectionScenario> {
    const parsed = scenarioIdInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('excluir cenario', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const existing = await this.scenarios.findById(input.userId, input.scenarioId);
    if (!existing) {
      throw new ScenarioNotFoundError();
    }

    await this.scenarios.delete(input.userId, input.scenarioId);
    return existing;
  }
}
