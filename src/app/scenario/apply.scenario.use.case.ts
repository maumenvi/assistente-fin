import { z } from 'zod';
import { Income } from '../../domain/income/income.entity.ts';
import { Money } from '../../domain/shared/money.value.object.ts';
import { Month } from '../../domain/shared/month.value.object.ts';
import { Recurrence } from '../../domain/shared/recurrence.value.object.ts';
import { DataSnapshot } from '../../domain/scenario/data.snapshot.entity.ts';
import { ScenarioApplication } from '../../domain/scenario/scenario.application.entity.ts';
import { ScenarioNotFoundError } from '../../domain/scenario/scenario.not.found.error.ts';
import { ScenarioApplicationExistsError } from '../../domain/scenario/scenario.application.exists.error.ts';
import { projectScenario } from '../../domain/scenario/project.scenario.ts';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { UserNotVerifiedError } from '../../domain/user/user.not.verified.error.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type Database } from '../shared/database.port.ts';
import { type Clock } from '../shared/clock.port.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { streamBackupRecords } from '../backup/stream.backup.records.ts';
import { serializeBackup } from '../backup/serialize.backup.ts';
import { resolveCategoryId } from '../category/resolve.category.id.ts';
import { scenarioIdInputSchema } from './scenario.id.input.schema.ts';
import { type ApplyScenarioResult } from './apply.scenario.result.ts';

/**
 * Categoria dos lancamentos criados por uma aplicacao - facilita achar/filtrar depois.
 * Desde a spec 003 e o NOME de uma categoria de verdade: `resolveCategoryId` cria na primeira
 * aplicacao e reusa nas seguintes, entao o usuario a ve na lista e pode ate renomea-la.
 */
const ADJUSTMENT_CATEGORY = 'ajuste de cenario';

/**
 * Caso de uso "aplicar cenario aos dados reais" (spec 002, RF-37, RF-37a, RF-39).
 *
 * Exige `user.isVerified()` (cria dado financeiro) e recusa se ja ha uma aplicacao
 * ativa (`ScenarioApplicationExistsError`). Dentro de `Database.transaction()`:
 * 1. grava um `DataSnapshot` do estado atual (ponto de restauracao, RF-37);
 * 2. projeta o cenario mes a mes e, **so nos meses de aumento liquido**, cria um `Income`
 *    de ajuste do valor do aumento; meses de reducao voltam em `skippedMonths` (RF-37a);
 * 3. grava o "recibo" (`ScenarioApplication`) com o `snapshotId` e os ids criados.
 */
export class ApplyScenarioUseCase {
  private readonly database: Database;
  private readonly ids: IdGenerator;
  private readonly clock: Clock;

  public constructor(database: Database, ids: IdGenerator, clock: Clock) {
    this.database = database;
    this.ids = ids;
    this.clock = clock;
  }

  public async execute(rawInput: unknown): Promise<ApplyScenarioResult> {
    const parsed = scenarioIdInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('aplicar cenario', flat.fieldErrors, flat.formErrors);
    }

    const { userId, scenarioId } = parsed.data;
    const user = await this.database.users.findById(userId);
    if (!user) {
      throw new UserNotFoundError();
    }
    if (!user.isVerified()) {
      throw new UserNotVerifiedError();
    }

    const scenario = await this.database.scenarios.findById(userId, scenarioId);
    if (!scenario) {
      throw new ScenarioNotFoundError();
    }
    if (await this.database.scenarioApplications.findActiveByUser(userId)) {
      throw new ScenarioApplicationExistsError();
    }

    const now = this.clock.now();

    return this.database.transaction(async (tx): Promise<ApplyScenarioResult> => {
      const { payload, recordCounts } = await serializeBackup(
        streamBackupRecords(tx, userId, now),
      );
      const snapshot = DataSnapshot.create({
        id: this.ids.next(),
        userId,
        originScenarioId: scenarioId,
        takenAt: now,
        recordCounts,
        payload,
      });
      await tx.dataSnapshots.save(snapshot);

      const [incomes, fixedExpenses, spendingLimits, allTransactions] = await Promise.all([
        tx.incomes.listByUser(userId),
        tx.fixedExpenses.listByUser(userId),
        tx.spendingLimits.listByUser(userId),
        tx.transactions.listByUser(userId),
      ]);

      const projection = projectScenario({
        baseInputs: {
          incomes,
          fixedExpenses,
          spendingLimits,
          historicalExpenses: allTransactions.filter((t) => t.type === 'expense'),
        },
        adjustments: scenario.adjustments,
        months: horizonMonths(Month.fromDate(now), scenario.horizonMonths),
      });

      const adjustmentCategoryId = await resolveCategoryId(tx.categories, this.ids, {
        userId,
        categoryName: ADJUSTMENT_CATEGORY,
      });

      const createdIncomeIds: string[] = [];
      const skippedMonths: string[] = [];

      for (const month of projection.months) {
        const netCents = month.incomeDeltaCents - month.expenseDeltaCents;
        if (netCents > 0) {
          const income = Income.create({
            id: this.ids.next(),
            userId,
            date: firstDayOf(month.month),
            amount: Money.fromCents(netCents),
            source: `Cenario: ${scenario.name}`,
            recurrence: Recurrence.none(),
            categoryId: adjustmentCategoryId,
          });
          await tx.incomes.save(income);
          createdIncomeIds.push(income.id);
        } else if (netCents < 0) {
          skippedMonths.push(month.month.toString());
        }
      }

      const application = ScenarioApplication.create({
        id: this.ids.next(),
        userId,
        scenarioId,
        snapshotId: snapshot.id,
        appliedAt: now,
        createdIncomeIds,
        createdFixedExpenseIds: [],
      });
      await tx.scenarioApplications.save(application);

      return {
        application,
        snapshotId: snapshot.id,
        createdIncomeCount: createdIncomeIds.length,
        skippedMonths,
      };
    });
  }
}

/** Primeiro dia do mes de competencia, em UTC. */
function firstDayOf(month: Month): Date {
  return new Date(Date.UTC(month.year, month.month - 1, 1));
}

/** `count` meses a partir de `start` (inclusive), em ordem. */
function horizonMonths(start: Month, count: number): Month[] {
  const months: Month[] = [];
  let cursor = start;
  for (let i = 0; i < count; i += 1) {
    months.push(cursor);
    cursor = cursor.next();
  }
  return months;
}
