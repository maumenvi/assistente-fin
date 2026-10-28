import { z } from 'zod';
import { type Fact } from '../../../domain/agent/fact.ts';
import { formatBrl } from '../verify/format.brl.ts';
import { type AgentTool } from './agent.tool.ts';
import { type AgentToolDeps } from './shared/agent.tool.deps.ts';
import { buildToolResult } from './shared/build.tool.result.ts';
import { countFact } from './shared/count.fact.ts';
import { dateFact } from './shared/date.fact.ts';
import { moneyFact } from './shared/money.fact.ts';
import { sanitizeText } from './shared/sanitize.text.ts';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use o formato AAAA-MM-DD');

const inputSchema = z
  .object({
    from: isoDate.describe('Data inicial (inclusive), AAAA-MM-DD.'),
    to: isoDate.describe('Data final (inclusive), AAAA-MM-DD.'),
    category: z.string().trim().min(1).max(80).optional().describe('Nome (ou parte do nome) da categoria. Para listar pendentes ("SEM CATEGORIA") em todas as contas sem precisar de período, prefira list_uncategorized_transactions.'),
    accountId: z.string().trim().min(1).max(100).optional().describe('Id da conta. OMITA para considerar todas as contas (nunca peça o id ao usuário).'),
    kind: z.enum(['expense', 'income']).optional().describe('expense = gastos, income = ganhos.'),
    text: z.string().trim().min(1).max(80).optional().describe('Texto contido na observacao do lancamento.'),
  })
  .refine((value) => value.from <= value.to, { message: 'from deve ser anterior ou igual a to', path: ['from'] });

type Args = z.infer<typeof inputSchema>;

function brDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/**
 * `query_transactions` (spec 031, T058): lancamentos do periodo com total, quantidade, soma por
 * categoria e amostra dos mais recentes. O `total` e o do Extrato (ganhos - gastos, sem excluir
 * nada), entao a resposta bate com o "Total do filtro" da tela. Somente leitura.
 */
export function queryTransactionsTool(deps: AgentToolDeps): AgentTool<Args> {
  return {
    id: 'query_transactions',
    description:
      'Consulta lancamentos (gastos e ganhos) de um periodo, com filtros opcionais de categoria, conta, tipo e texto. Devolve total, quantidade, soma por categoria e os lancamentos mais recentes. Use para "quanto gastei com X em tal mes". Para listar tudo o que esta "SEM CATEGORIA", use list_uncategorized_transactions.',
    effect: 'read',
    input: inputSchema,
    async run(args, ctx) {
      const listed = await deps.listTransactions.execute({ userId: ctx.userId });
      const wantedCategory = args.category?.toUpperCase();
      const wantedText = args.text?.toLowerCase();
      const rows = listed.filter(({ item, categoryName }) => {
        const day = item.date.toISOString().slice(0, 10);
        if (day < args.from || day > args.to) return false;
        if (args.accountId !== undefined && item.accountId !== args.accountId) return false;
        if (args.kind !== undefined && item.type !== args.kind) return false;
        if (wantedCategory !== undefined && !categoryName.toUpperCase().includes(wantedCategory)) return false;
        if (wantedText !== undefined && !(item.notes ?? '').toLowerCase().includes(wantedText)) return false;
        return true;
      });
      const signed = (type: string, cents: number): number => (type === 'income' ? cents : -cents);
      let incomeCents = 0;
      let expenseCents = 0;
      const byCategory = new Map<string, { name: string; cents: number; count: number }>();
      for (const { item, categoryName } of rows) {
        if (item.type === 'income') incomeCents += item.amount.cents;
        else expenseCents += item.amount.cents;
        const entry = byCategory.get(item.categoryId) ?? { name: categoryName, cents: 0, count: 0 };
        entry.cents += signed(item.type, item.amount.cents);
        entry.count += 1;
        byCategory.set(item.categoryId, entry);
      }
      const netCents = incomeCents - expenseCents;
      const categories = [...byCategory.entries()]
        .sort((a, b) => Math.abs(b[1].cents) - Math.abs(a[1].cents) || a[0].localeCompare(b[0]))
        .slice(0, ctx.limits.maxItems);
      const sample = [...rows]
        .sort((a, b) => b.item.date.getTime() - a.item.date.getTime() || a.item.id.localeCompare(b.item.id))
        .slice(0, ctx.limits.maxItems);

      const facts: Fact[] = [
        moneyFact('total', 'total do periodo (ganhos - gastos)', netCents),
        moneyFact('gastos', 'total de gastos', expenseCents),
        moneyFact('ganhos', 'total de ganhos', incomeCents),
        countFact('quantidade', 'quantidade de lancamentos', rows.length),
        ...categories.map(([id, entry]) => moneyFact(`categoria.${id}`, `total da categoria ${sanitizeText(entry.name, 40)}`, entry.cents)),
        ...sample.flatMap(({ item }) => [
          moneyFact(`item.${item.id}.valor`, 'valor do lancamento', item.amount.cents),
          dateFact(`item.${item.id}.data`, 'data do lancamento', item.date.toISOString()),
        ]),
      ];

      const lines = [
        `Periodo: ${brDate(args.from)} a ${brDate(args.to)}`,
        `Quantidade: ${rows.length} lancamentos`,
        `Gastos: ${formatBrl(expenseCents)}`,
        `Ganhos: ${formatBrl(incomeCents)}`,
        `Total (ganhos - gastos): ${formatBrl(netCents)}`,
      ];
      if (categories.length > 0) {
        lines.push('Por categoria (ganhos positivos, gastos negativos):');
        for (const [, entry] of categories) lines.push(`- ${sanitizeText(entry.name, 40)}: ${formatBrl(entry.cents)} (${entry.count} lancamentos)`);
      }
      if (sample.length > 0) {
        lines.push(`Mais recentes (${sample.length} de ${rows.length}):`);
        for (const { item, categoryName } of sample) {
          const note = item.notes === undefined || item.notes === '' ? '' : ` - ${sanitizeText(item.notes)}`;
          lines.push(`- ${brDate(item.date.toISOString().slice(0, 10))} ${item.type === 'income' ? 'ganho' : 'gasto'} ${formatBrl(item.amount.cents)} ${sanitizeText(categoryName, 40)}${note} [id ${item.id}]`);
        }
      }
      const filters: Record<string, string> = { de: args.from, ate: args.to };
      if (args.category !== undefined) filters['categoria'] = sanitizeText(args.category, 40);
      if (args.accountId !== undefined) filters['conta'] = args.accountId;
      if (args.kind !== undefined) filters['tipo'] = args.kind;
      if (args.text !== undefined) filters['texto'] = sanitizeText(args.text, 40);
      return buildToolResult({
        tool: 'query_transactions',
        body: lines.join('\n'),
        facts,
        summary: {
          tool: 'query_transactions',
          label: `lancamentos de ${brDate(args.from)} a ${brDate(args.to)}${args.category === undefined ? '' : ` - categoria ${sanitizeText(args.category, 40)}`}`,
          filters,
          itemCount: rows.length,
          truncated: rows.length > sample.length,
        },
        maxChars: ctx.limits.maxChars,
      });
    },
  };
}
