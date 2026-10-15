import { z } from 'zod';
import { type ScenarioApplication } from '../../domain/scenario/scenario.application.entity.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type ScenarioApplicationRepository } from './scenario.application.repository.port.ts';

const inputSchema = z.object({
  userId: z.string().trim().min(1, 'userId obrigatorio'),
});

/**
 * Caso de uso "ha uma aplicacao de cenario ativa?" (spec 002, RF-40). So leitura: devolve o
 * "recibo" ativo do usuario, ou `null`.
 */
export class GetActiveScenarioApplicationUseCase {
  private readonly applications: ScenarioApplicationRepository;

  public constructor(applications: ScenarioApplicationRepository) {
    this.applications = applications;
  }

  public async execute(rawInput: unknown): Promise<ScenarioApplication | null> {
    const parsed = inputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('consultar aplicacao ativa', flat.fieldErrors, flat.formErrors);
    }

    return this.applications.findActiveByUser(parsed.data.userId);
  }
}
