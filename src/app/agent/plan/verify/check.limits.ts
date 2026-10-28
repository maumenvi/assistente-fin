import { formatBrl } from '../../verify/format.brl.ts';
import { type PlanFlag } from '../../../../domain/plan/plan.flag.ts';
import { type OperationInput } from '../operations/operation.adapter.ts';
import { type VerifyContext } from './verify.context.ts';

/** Despesa em cartao de credito acima do limite disponivel: alerta com o quanto estoura. */
export async function checkCardLimit(kind: string, input: OperationInput, ctx: VerifyContext): Promise<PlanFlag | null> {
  if (kind !== 'transaction.create' || input['type'] !== 'expense' || typeof input['accountId'] !== 'string') return null;
  const account = await ctx.db.accounts.findById(ctx.userId, input['accountId']);
  if (account === null || account.kind !== 'credit-card') return null;
  const available = await ctx.deps.calculateCreditCardAvailableLimit.execute({ userId: ctx.userId, accountId: account.id });
  const amount = Number(input['amountCents']);
  return amount > available.cents ? { flag: 'limit_impact', text: `passa do limite disponivel do cartao (${formatBrl(available.cents)}) em ${formatBrl(amount - available.cents)}` } : null;
}
