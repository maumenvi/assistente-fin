import { z } from 'zod';
import { type Fact } from '../../../domain/agent/fact.ts';
import { usagePercent } from '../../spending-limit/usage.percent.ts';
import { formatBrl } from '../verify/format.brl.ts';
import { type AgentTool } from './agent.tool.ts';
import { type AgentToolDeps } from './shared/agent.tool.deps.ts';
import { buildToolResult } from './shared/build.tool.result.ts';
import { dateFact } from './shared/date.fact.ts';
import { monthArgSchema, monthLabel, parseMonthArg } from './shared/month.arg.ts';
import { moneyFact } from './shared/money.fact.ts';
import { percentFact } from './shared/percent.fact.ts';
import { sanitizeText } from './shared/sanitize.text.ts';

const inputSchema = z.object({
  accountId: z.string().trim().min(1).max(100).optional().describe('Id do cartao; omita para todos os cartoes.'),
  month: monthArgSchema.optional().describe('Mes de VENCIMENTO da fatura (AAAA-MM); omita para a proxima fatura.'),
});

type Args = z.infer<typeof inputSchema>;

function brDate(date: Date): string {
  const iso = date.toISOString();
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/**
 * `get_credit_card_status` (spec 031, T059): fatura, limite disponivel e saldo comprometido de
 * cada cartao, pelos mesmos casos de uso das telas. Cartao sem limite/fechamento/vencimento
 * configurados aparece como "sem termos configurados". Somente leitura.
 */
export function getCreditCardStatusTool(deps: AgentToolDeps): AgentTool<Args> {
  return {
    id: 'get_credit_card_status',
    description:
      'Situacao dos cartoes de credito: valor e vencimento da fatura, limite disponivel e saldo comprometido (parcelas futuras). Use para perguntas sobre fatura, limite ou compras no cartao.',
    effect: 'read',
    input: inputSchema,
    async run(args, ctx) {
      const accounts = await deps.listAccounts.execute({ userId: ctx.userId });
      const cards = accounts
        .filter((account) => account.kind === 'credit-card' && !account.archived && (args.accountId === undefined || account.id === args.accountId))
        .slice(0, ctx.limits.maxItems);
      const month = args.month === undefined ? undefined : parseMonthArg(args.month);
      const facts: Fact[] = [];
      const lines: string[] = [];
      for (const card of cards) {
        const name = sanitizeText(card.name, 60);
        if (card.creditLimit === null || card.closingDay === null || card.dueDay === null) {
          lines.push(`- ${name} (id ${card.id}): sem termos configurados (limite, fechamento e vencimento).`);
          continue;
        }
        const base = { userId: ctx.userId, accountId: card.id };
        const [invoice, available, committed] = await Promise.all([
          deps.calculateCreditCardInvoice.execute(month === undefined ? base : { ...base, month }),
          deps.calculateCreditCardAvailableLimit.execute(base),
          deps.calculateCreditCardCommittedBalance.execute(base),
        ]);
        const limitCents = card.creditLimit.cents;
        const usedPercent = usagePercent(limitCents - available.cents, limitCents);
        facts.push(
          moneyFact(`fatura.${card.id}`, `fatura do cartao ${name}`, invoice.amount.cents),
          dateFact(`vencimento.${card.id}`, `vencimento da fatura de ${name}`, invoice.dueDate.toISOString()),
          moneyFact(`limite.${card.id}`, `limite total de ${name}`, limitCents),
          moneyFact(`disponivel.${card.id}`, `limite disponivel de ${name}`, available.cents),
          moneyFact(`comprometido.${card.id}`, `saldo comprometido de ${name}`, committed.amount.cents),
          percentFact(`usado.${card.id}`, `percentual do limite usado em ${name}`, usedPercent),
        );
        lines.push(
          `- ${name} (id ${card.id}): fatura ${formatBrl(invoice.amount.cents)} com vencimento em ${brDate(invoice.dueDate)}; limite total ${formatBrl(limitCents)}; disponivel ${formatBrl(available.cents)}; comprometido ${formatBrl(committed.amount.cents)}; ${usedPercent}% do limite usado.`,
        );
      }
      return buildToolResult({
        tool: 'get_credit_card_status',
        body: cards.length === 0 ? 'Nenhum cartao de credito encontrado.' : lines.join('\n'),
        facts,
        summary: {
          tool: 'get_credit_card_status',
          label: month === undefined ? 'cartoes de credito - proxima fatura' : `cartoes de credito - fatura de ${monthLabel(month)}`,
          filters: {
            ...(args.accountId === undefined ? {} : { cartao: args.accountId }),
            ...(args.month === undefined ? {} : { mes: args.month }),
          },
          itemCount: cards.length,
          truncated: false,
        },
        maxChars: ctx.limits.maxChars,
      });
    },
  };
}
