import { z } from 'zod';
import { ScenarioApplicationNotFoundError } from '../../domain/scenario/scenario.application.not.found.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type Database } from '../shared/database.port.ts';
import { revertScenarioApplicationInputSchema } from './revert.scenario.application.input.schema.ts';

/** Resultado de `RevertScenarioApplicationByRecordsUseCase`. */
export interface RevertByRecordsResult {
  readonly removedIncomeCount: number;
  readonly removedFixedExpenseCount: number;
}

/**
 * Caso de uso "desfazer aplicacao removendo os lancamentos" (spec 002, RF-38, caminho
 * rapido).
 *
 * Dentro de `Database.transaction()`: le o recibo, apaga exatamente os ids que ele lista
 * (nada mais) e apaga o proprio recibo - encerrando a aplicacao ativa. `ScenarioApplicationNotFoundError`
 * fora do escopo do usuario. Nao restaura o snapshot; se o usuario editou a mao os
 * lancamentos criados, a opcao "restaurar snapshot" e a alternativa.
 */
export class RevertScenarioApplicationByRecordsUseCase {
  private readonly database: Database;

  public constructor(database: Database) {
    this.database = database;
  }

  public async execute(rawInput: unknown): Promise<RevertByRecordsResult> {
    const parsed = revertScenarioApplicationInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('desfazer aplicacao de cenario', flat.fieldErrors, flat.formErrors);
    }

    const { userId, applicationId } = parsed.data;

    return this.database.transaction(async (tx): Promise<RevertByRecordsResult> => {
      const application = await tx.scenarioApplications.findById(userId, applicationId);
      if (!application) {
        throw new ScenarioApplicationNotFoundError();
      }

      for (const incomeId of application.createdIncomeIds) {
        await tx.incomes.delete(userId, incomeId);
      }
      for (const fixedExpenseId of application.createdFixedExpenseIds) {
        await tx.fixedExpenses.delete(userId, fixedExpenseId);
      }
      await tx.scenarioApplications.delete(userId, applicationId);

      return {
        removedIncomeCount: application.createdIncomeIds.length,
        removedFixedExpenseCount: application.createdFixedExpenseIds.length,
      };
    });
  }
}
