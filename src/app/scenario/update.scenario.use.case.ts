import { z } from 'zod';
import { ProjectionScenario } from '../../domain/scenario/projection.scenario.entity.ts';
import { ScenarioNotFoundError } from '../../domain/scenario/scenario.not.found.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type ScenarioRepository } from './scenario.repository.port.ts';
import { updateScenarioInputSchema } from './update.scenario.input.schema.ts';
import { toScenarioAdjustment } from './to.scenario.adjustment.ts';

/**
 * Caso de uso "atualizar cenario" (spec 002, RF-36, RF-31).
 *
 * `ScenarioNotFoundError` fora do escopo do usuario. `ProjectionScenario` nao tem transicoes:
 * reconstroi via `create` com o mesmo id, mesclando os campos enviados, e
 * `withUpdatedAt(expectedUpdatedAt ?? existing.updatedAt)` - a trava otimista no `save`
 * lanca `StaleDataError` se outra interface tiver alterado o cenario nesse meio-tempo.
 */
export class UpdateScenarioUseCase {
  private readonly scenarios: ScenarioRepository;

  public constructor(scenarios: ScenarioRepository) {
    this.scenarios = scenarios;
  }

  public async execute(rawInput: unknown): Promise<ProjectionScenario> {
    const parsed = updateScenarioInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('atualizar cenario', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const existing = await this.scenarios.findById(input.userId, input.scenarioId);
    if (!existing) {
      throw new ScenarioNotFoundError();
    }

    const updated = ProjectionScenario.create({
      id: existing.id,
      userId: existing.userId,
      name: input.name ?? existing.name,
      adjustments:
        input.adjustments !== undefined
          ? input.adjustments.map(toScenarioAdjustment)
          : existing.adjustments,
      horizonMonths: input.horizonMonths ?? existing.horizonMonths,
    }).withUpdatedAt(
      input.expectedUpdatedAt !== undefined
        ? new Date(input.expectedUpdatedAt)
        : existing.updatedAt,
    );

    await this.scenarios.save(updated);
    return updated;
  }
}
