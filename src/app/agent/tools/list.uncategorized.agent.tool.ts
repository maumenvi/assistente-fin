import { z } from 'zod';
import { type Fact } from '../../../domain/agent/fact.ts';
import { DEFAULT_CATEGORY_NAME } from '../../../domain/category/default.category.name.ts';
import { BULK_PLAN_BATCH_SIZE } from '../plan/rules/bulk.plan.batch.size.ts';
import { formatBrl } from '../verify/format.brl.ts';
import { type AgentTool } from './agent.tool.ts';
import { type AgentToolDeps } from './shared/agent.tool.deps.ts';
import { buildToolResult } from './shared/build.tool.result.ts';
import { countFact } from './shared/count.fact.ts';
import { dateFact } from './shared/date.fact.ts';
import { moneyFact } from './shared/money.fact.ts';
import { sanitizeText } from './shared/sanitize.text.ts';

const dateArg = z
  .string()
  .trim()
  .regex(/^(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})$/, 'use AAAA-MM-DD ou dd/mm/aaaa');

const inputSchema = z.object({
  offset: z.number().int().min(0).optional().describe('Deslocamento da pagina (0, 50, 100...). Padrao: 0.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(BULK_PLAN_BATCH_SIZE)
    .optional()
    .describe(`Tamanho da pagina (1 a ${BULK_PLAN_BATCH_SIZE}). Padrao: ${BULK_PLAN_BATCH_SIZE}.`),
  from: dateArg.optional().describe('Data inicial opcional (AAAA-MM-DD ou dd/mm/aaaa). Omita para todo o historico.'),
  to: dateArg.optional().describe('Data final opcional (AAAA-MM-DD ou dd/mm/aaaa). Omita para todo o historico.'),
  accountId: z.string().trim().min(1).max(100).optional().describe('Id da conta opcional. Omita para listar todas as contas.'),
});

type Args = z.infer<typeof inputSchema>;

function toIsoDate(raw: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const [dd, mm, yyyy] = raw.split('/');
  return `${yyyy}-${mm}-${dd}`;
}

function brDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

/**
 * `list_uncategorized_transactions` (spec 037, US1): lista todos os lancamentos em "SEM CATEGORIA"
 * em todas as contas (ou filtrados por conta/periodo), com contagem e soma exatas do total e
 * paginacao de ate 50 itens em ordem estavel (data desc, id desc). Somente leitura.
 */
export function listUncategorizedTransactionsTool(deps: AgentToolDeps): AgentTool<Args> {
  return {
    id: 'list_uncategorized_transactions',
    description:
      'Lista lancamentos pendentes de classificacao (categoria "SEM CATEGORIA") em todas as contas, sem exigir periodo nem conta. Devolve total_count, total_sum e pagina de ate 50 itens com id, data, valor, descricao e conta. Use sempre que a pessoa pedir "o que esta sem categoria" ou "categorize tudo que esta sem categoria".',
    effect: 'read',
    input: inputSchema,
    async run(args, ctx) {
      const offset = args.offset ?? 0;
      const limit = args.limit ?? BULK_PLAN_BATCH_SIZE;
      const fromIso = args.from === undefined ? undefined : toIsoDate(args.from);
      const toIso = args.to === undefined ? undefined : toIsoDate(args.to);

      const [listed, accounts] = await Promise.all([
        deps.listTransactions.execute({ userId: ctx.userId }),
        deps.listAccounts.execute({ userId: ctx.userId }),
      ]);
      const accountNames = new Map(accounts.map((acc) => [acc.id, acc.name]));

      const pending = listed
        .filter(({ item, categoryName }) => {
          if (categoryName.toUpperCase() !== DEFAULT_CATEGORY_NAME) return false;
          if (args.accountId !== undefined && item.accountId !== args.accountId) return false;
          const day = item.date.toISOString().slice(0, 10);
          if (fromIso !== undefined && day < fromIso) return false;
          if (toIso !== undefined && day > toIso) return false;
          return true;
        })
        .sort((a, b) => b.item.date.getTime() - a.item.date.getTime() || b.item.id.localeCompare(a.item.id));

      const totalCount = pending.length;
      const totalSumCents = pending.reduce((sum, { item }) => sum + item.amount.cents, 0);
      const page = pending.slice(offset, offset + limit);
      const hasMore = offset + page.length < totalCount;

      const totalBatches = totalCount === 0 ? 0 : Math.ceil(totalCount / limit);
      const batchIndex = totalCount === 0 ? 0 : Math.floor(offset / limit) + 1;
      const facts: Fact[] = [
        countFact('total_count', 'total de lancamentos sem categoria', totalCount),
        moneyFact('total_sum', 'soma total dos lancamentos sem categoria', totalSumCents),
        ...(totalCount > 0
          ? [
              countFact('page_count', 'itens nesta pagina', page.length),
              countFact('batch_index', 'numero do lote atual', batchIndex),
              countFact('total_batches', 'total de lotes', totalBatches),
            ]
          : []),
        ...page.flatMap(({ item }) => [
          moneyFact(`item.${item.id}.valor`, 'valor do lancamento sem categoria', item.amount.cents),
          dateFact(`item.${item.id}.data`, 'data do lancamento sem categoria', item.date.toISOString()),
        ]),
      ];

      const lines: string[] = [];
      if (totalCount === 0) {
        lines.push('Nenhum lançamento sem categoria encontrado.');
      } else {
        lines.push(`Total sem categoria: ${totalCount} lancamentos (${formatBrl(totalSumCents)})`);
        lines.push(
          `Pagina: exibindo ${page.length} de ${totalCount} (offset ${offset}, limite ${limit}, mais itens: ${hasMore ? 'sim' : 'nao'})`,
        );
        for (const { item } of page) {
          const iso = item.date.toISOString().slice(0, 10);
          const kind = item.type === 'income' ? 'ganho' : 'gasto';
          const desc =
            item.notes === undefined || item.notes.trim() === ''
              ? '(sem descricao)'
              : sanitizeText(item.notes, 60);
          const accName = sanitizeText(accountNames.get(item.accountId) ?? item.accountId, 30);
          lines.push(`- ${brDate(iso)} ${kind} ${formatBrl(item.amount.cents)} ${desc} (conta ${accName}) [id ${item.id}]`);
        }
      }

      const filters: Record<string, string> = { categoria: DEFAULT_CATEGORY_NAME };
      if (fromIso !== undefined) filters['de'] = fromIso;
      if (toIso !== undefined) filters['ate'] = toIso;
      if (args.accountId !== undefined) filters['conta'] = args.accountId;

      return buildToolResult({
        tool: 'list_uncategorized_transactions',
        body: lines.join('\n'),
        facts,
        maxChars: Math.max(ctx.limits.maxChars, 8000),
        summary: {
          tool: 'list_uncategorized_transactions',
          label: 'lancamentos sem categoria',
          filters,
          itemCount: totalCount,
          truncated: hasMore,
        },
      });
    },
  };
}
