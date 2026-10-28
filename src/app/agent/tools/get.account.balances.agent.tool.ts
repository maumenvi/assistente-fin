import { z } from 'zod';
import { computeAccountBalance } from '../../dashboard/compute.view.account.balance.ts';
import { type AgentTool } from './agent.tool.ts';
import { type AgentToolDeps } from './shared/agent.tool.deps.ts';
import { buildToolResult } from './shared/build.tool.result.ts';
import { moneyFact } from './shared/money.fact.ts';
import { sanitizeText } from './shared/sanitize.text.ts';
import { toDashboardTransaction } from './shared/to.dashboard.transaction.ts';
import { formatBrl } from '../verify/format.brl.ts';

const inputSchema = z.object({
  accountId: z.string().trim().min(1).max(100).optional().describe('Id de uma conta; omita para todas as contas.'),
});

type Args = z.infer<typeof inputSchema>;

/**
 * `get_account_balances` (spec 031, T057): saldo atual de cada conta de saldo e o saldo
 * disponivel total, calculados pela MESMA funcao do Dashboard (cartao de credito fica de fora:
 * use `get_credit_card_status`). Somente leitura.
 */
export function getAccountBalancesTool(deps: AgentToolDeps): AgentTool<Args> {
  return {
    id: 'get_account_balances',
    description:
      'Saldo atual de cada conta (corrente, poupanca, carteira) e o saldo disponivel total. Use para perguntas como "quanto tenho na conta X" ou "qual meu saldo". Nao inclui cartao de credito.',
    effect: 'read',
    input: inputSchema,
    async run(args, ctx) {
      const [accounts, listed] = await Promise.all([
        deps.listAccounts.execute({ userId: ctx.userId }),
        deps.listTransactions.execute({ userId: ctx.userId }),
      ]);
      const transactions = listed.map(toDashboardTransaction);
      const balanceAccounts = accounts.filter(
        (account) => account.kind !== 'credit-card' && (args.accountId === undefined || account.id === args.accountId),
      );
      const rows = balanceAccounts.map((account) => ({
        account,
        cents: computeAccountBalance(transactions, account.id, ctx.now, account.openingBalanceDate),
      }));
      const totalCents = rows
        .reduce((sum, row) => sum + row.cents, 0);
      const facts = [
        ...rows.map((row) => moneyFact(`saldo.${row.account.id}`, `saldo de ${sanitizeText(row.account.name, 60)}`, row.cents)),
        moneyFact('saldo.total', args.accountId === undefined ? 'saldo disponivel total' : 'saldo das contas consultadas', totalCents),
      ];
      const lines = rows.slice(0, ctx.limits.maxItems).map(
        (row) => `- ${sanitizeText(row.account.name, 60)} (id ${row.account.id}, ${row.account.kind}${row.account.isBenefit ? ', beneficio' : ''}): ${formatBrl(row.cents)}`,
      );
      const body = rows.length === 0 ? 'Nenhuma conta de saldo encontrada.' : `${lines.join('\n')}\nTotal: ${formatBrl(totalCents)}`;
      return buildToolResult({
        tool: 'get_account_balances',
        body,
        facts,
        summary: {
          tool: 'get_account_balances',
          label: args.accountId === undefined ? 'saldo das contas' : 'saldo da conta',
          filters: args.accountId === undefined ? {} : { conta: args.accountId },
          itemCount: rows.length,
          truncated: rows.length > ctx.limits.maxItems,
        },
        maxChars: ctx.limits.maxChars,
      });
    },
  };
}
