import { Money } from '../../../../domain/shared/money.value.object.ts';
import { Transaction } from '../../../../domain/transaction/transaction.entity.ts';
import { type PlanFlag } from '../../../../domain/plan/plan.flag.ts';
import { type OperationInput } from '../operations/operation.adapter.ts';
import { type VerifyContext } from './verify.context.ts';

interface Candidate {
  readonly kind: string;
  readonly input: OperationInput;
  readonly itemId: string;
}

const keyOf = (i: OperationInput): string => `${String(i['accountId'])}|${String(i['type'])}|${String(i['amountCents'])}|${String(i['date'])}`;

/**
 * Duplicata de lancamento novo: ja existe igual no banco (`findDuplicate`: mesma conta, tipo, valor e
 * dia) ou o mesmo lancamento aparece antes no proprio plano. Devolve o alerta por id de item.
 */
export async function checkDuplicates(candidates: readonly Candidate[], ctx: VerifyContext): Promise<Map<string, PlanFlag>> {
  const flags = new Map<string, PlanFlag>();
  const seen = new Map<string, string>();
  for (const c of candidates) {
    if (c.kind !== 'transaction.create') continue;
    const key = keyOf(c.input);
    const earlier = seen.get(key);
    if (earlier !== undefined) {
      flags.set(c.itemId, { flag: 'duplicate', text: 'igual a outro lancamento deste plano', ref: earlier });
      continue;
    }
    seen.set(key, c.itemId);
    const i = c.input;
    const existing = await ctx.db.transactions.findDuplicate(
      Transaction.create({
        id: `candidate-${c.itemId}`,
        userId: ctx.userId,
        date: new Date(`${String(i['date']).slice(0, 10)}T12:00:00.000Z`),
        amount: Money.fromCents(Number(i['amountCents'])),
        type: i['type'] as 'expense' | 'income',
        categoryId: typeof i['categoryId'] === 'string' ? i['categoryId'] : 'candidate',
        accountId: String(i['accountId']),
      }),
    );
    if (existing !== null) flags.set(c.itemId, { flag: 'duplicate', text: 'ja existe um lancamento igual (mesma conta, valor e dia)', ref: existing.id });
  }
  return flags;
}
