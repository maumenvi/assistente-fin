import { z } from 'zod';
import { PurchaseSimulation } from '../../domain/simulation/simulation.entity.ts';
import { calculatePurchaseImpact } from '../../domain/simulation/purchase.simulation.ts';
import { Money } from '../../domain/shared/money.value.object.ts';
import { Recurrence } from '../../domain/shared/recurrence.value.object.ts';
import { toRecurrence } from '../shared/to.recurrence.ts';
import { type Month } from '../../domain/shared/month.value.object.ts';
import { UserNotFoundError } from '../../domain/user/user.not.found.error.ts';
import { AccountNotFoundError } from '../../domain/account/account.not.found.error.ts';
import { type IdGenerator } from '../shared/id.generator.port.ts';
import { InvalidInputError } from '../shared/invalid.input.error.ts';
import { type UserRepository } from '../user/user.repository.port.ts';
import { type AccountRepository } from '../account/account.repository.port.ts';
import { type CategoryRepository } from '../category/category.repository.port.ts';
import { resolveCategoryId } from '../category/resolve.category.id.ts';
import { type SimulationRepository } from './simulation.repository.port.ts';
import { type GetMonthlyForecastUseCase } from '../forecast/get.monthly.forecast.use.case.ts';
import { simulatePurchaseInputSchema } from './simulate.purchase.input.schema.ts';

/** Impacto de uma simulacao num mes, com o saldo previsto antes/depois (spec 001, RF-10). */
export interface SimulatedMonthImpact {
  readonly month: Month;
  readonly amount: Money;
  readonly projectedBalanceBefore: Money;
  readonly projectedBalanceAfter: Money;
}

/** Resultado de `SimulatePurchaseUseCase`. */
export interface SimulatePurchaseResult {
  readonly simulation: PurchaseSimulation;
  readonly impacts: readonly SimulatedMonthImpact[];
}

/**
 * Caso de uso "simular compra" (spec 001, RF-9, RF-10, CA-8..CA-10).
 *
 * Nao exige usuario verificado - e uma previa/rascunho, nao cria dado financeiro "de
 * verdade" ainda (decisao 9 do plano; so `ApproveSimulation`, que de fato gera `Transaction`
 * ou `FixedExpense`, exige - plan.md, decisao 13). Persiste a simulacao (precisa existir pra
 * `ApproveSimulation` achar por id depois) e, pra cada mes que ela impacta
 * (`calculatePurchaseImpact`, dominio puro), chama `GetMonthlyForecastUseCase` pra saber o
 * saldo previsto sem a compra e calcula o saldo com ela subtraida.
 */
export class SimulatePurchaseUseCase {
  private readonly simulations: SimulationRepository;
  private readonly users: UserRepository;
  private readonly accounts: AccountRepository;
  private readonly categories: CategoryRepository;
  private readonly ids: IdGenerator;
  private readonly getMonthlyForecast: GetMonthlyForecastUseCase;

  public constructor(
    simulations: SimulationRepository,
    users: UserRepository,
    accounts: AccountRepository,
    categories: CategoryRepository,
    ids: IdGenerator,
    getMonthlyForecast: GetMonthlyForecastUseCase,
  ) {
    this.simulations = simulations;
    this.users = users;
    this.accounts = accounts;
    this.categories = categories;
    this.ids = ids;
    this.getMonthlyForecast = getMonthlyForecast;
  }

  public async execute(rawInput: unknown): Promise<SimulatePurchaseResult> {
    const parsed = simulatePurchaseInputSchema.safeParse(rawInput);
    if (!parsed.success) {
      const flat = z.flattenError(parsed.error);
      throw new InvalidInputError('simular compra', flat.fieldErrors, flat.formErrors);
    }

    const input = parsed.data;
    const user = await this.users.findById(input.userId);
    if (!user) {
      throw new UserNotFoundError();
    }
    const account = await this.accounts.findById(input.userId, input.accountId);
    if (!account) {
      throw new AccountNotFoundError();
    }

    const categoryId = await resolveCategoryId(this.categories, this.ids, input);

    const simulation = PurchaseSimulation.create({
      id: this.ids.next(),
      userId: input.userId,
      amount: Money.fromCents(input.amountCents),
      date: new Date(input.date),
      categoryId,
      payment: input.payment,
      installments: input.installments,
      recurrence: input.recurrence ? toRecurrence(input.recurrence) : Recurrence.none(),
      accountId: input.accountId,
    });

    await this.simulations.save(simulation);

    const monthlyImpacts = calculatePurchaseImpact(simulation, {
      horizonMonths: input.horizonMonths,
    });

    const impacts = await Promise.all(
      monthlyImpacts.map(async (impact): Promise<SimulatedMonthImpact> => {
        const forecast = await this.getMonthlyForecast.execute({
          userId: input.userId,
          month: { year: impact.month.year, month: impact.month.month },
          windowMonths: input.windowMonths,
        });
        return {
          month: impact.month,
          amount: impact.amount,
          projectedBalanceBefore: forecast.projectedBalance,
          projectedBalanceAfter: forecast.projectedBalance.subtract(impact.amount),
        };
      }),
    );

    return { simulation, impacts };
  }
}
