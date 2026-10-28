import { z } from 'zod';
import { ATTACHMENT_LIMITS } from '../../../../domain/agent/attachment/attachment.limits.ts';
import { READ_ATTACHMENT_TOOL } from '../../../../domain/agent/attachment/attachment.tool.name.ts';
import { type Fact } from '../../../../domain/agent/fact.ts';
import { type AgentTool } from '../../tools/agent.tool.ts';
import { buildToolError } from '../../tools/shared/build.tool.error.ts';
import { buildToolResult } from '../../tools/shared/build.tool.result.ts';
import { countFact } from '../../tools/shared/count.fact.ts';
import { rowsValueFacts, sheetFacts, textValueFacts } from '../model/attachment.facts.ts';
import { rowLine } from '../model/attachment.summary.ts';
import { sanitizeAttachmentText } from '../model/sanitize.attachment.text.ts';
import { type AttachmentStorePort } from '../ports/attachment.store.port.ts';

const inputSchema = z.object({
  attachmentId: z.string().trim().min(1).max(100).describe('O id do anexo (aparece no bloco <dado_externo> da mensagem).'),
  sheet: z.string().trim().min(1).max(100).optional().describe('Nome da aba (planilha) ou tabela; omita para a primeira.'),
  offset: z.int().min(0).optional().describe('Primeira linha a ler (começa em 0).'),
  limit: z.int().min(1).max(ATTACHMENT_LIMITS.pageRows).optional().describe(`Quantas linhas ler (máximo ${ATTACHMENT_LIMITS.pageRows}); padrão 50.`),
});
type Args = z.infer<typeof inputSchema>;

/**
 * `read_attachment` (spec 036, FR-005): le um anexo da conversa por partes (linhas de uma aba ou trechos de texto). So anexos do
 * usuario E da conversa. O resultado e DADO (envelope `<dados>`); contagens e totais sao fatos calculados pelo app a partir do
 * arquivo. O conteudo nunca vai ao registro: o trace troca o resultado desta ferramenta por um marcador (T010).
 */
export function readAttachmentTool(store: AttachmentStorePort): AgentTool<Args> {
  return {
    id: READ_ATTACHMENT_TOOL,
    description:
      'Lê o conteúdo de um anexo (planilha, csv, txt ou pdf) enviado nesta conversa, por partes. Use quando o bloco do anexo vier "cortado" ou para ver outras abas/linhas. Devolve as linhas pedidas, o total de linhas e a soma das colunas numéricas (calculada pelo app).',
    effect: 'read',
    input: inputSchema,
    async run(args, ctx) {
      const found = await store.get(ctx.userId, args.attachmentId);
      if (found === null || (ctx.source !== undefined && found.conversationId !== ctx.source.conversationId)) {
        return buildToolError(READ_ATTACHMENT_TOOL, { code: 'not_found', message: 'anexo nao encontrado nesta conversa' });
      }
      const content = found.extracted;
      if (content === null) return buildToolError(READ_ATTACHMENT_TOOL, { code: 'invalid_args', message: 'este anexo e uma imagem: ela ja foi enviada junto com a mensagem' });
      const offset = args.offset ?? 0;
      const limit = args.limit ?? 50;
      const facts: Fact[] = [];
      let body: string;
      let total: number;
      let returned: number;
      let label = `anexo ${found.name}`;
      const sheet = args.sheet === undefined ? content.sheets[0] : content.sheets.find((s) => s.name.toLowerCase() === (args.sheet as string).toLowerCase());
      if (content.sheets.length > 0 && sheet === undefined) {
        return buildToolError(READ_ATTACHMENT_TOOL, { code: 'invalid_args', message: `aba nao encontrada; abas: ${content.sheets.map((s) => s.name).join(', ')}` });
      }
      if (sheet !== undefined && (content.sheets.length > 0 || content.text === null)) {
        const rows = sheet.rows.slice(offset, offset + limit);
        returned = rows.length;
        total = sheet.rowCount;
        label = `anexo ${found.name} · ${sheet.name}`;
        body = [`Aba "${sheet.name}": linhas ${offset}-${offset + returned - 1} de ${total} (${sheet.totalRows} no arquivo)`, `Cabeçalho: ${rowLine(sheet.header)}`, ...rows.map((r, i) => `${offset + i}: ${rowLine(r)}`)].join('\n');
        facts.push(...sheetFacts(found, sheet), ...rowsValueFacts(`attachment:${found.id}:r${offset}`, sheet.header, rows));
      } else {
        const lines = (content.text ?? '').split('\n');
        const part = lines.slice(offset, offset + limit);
        returned = part.length;
        total = lines.length;
        body = `Texto: linhas ${offset}-${offset + returned - 1} de ${total}\n${sanitizeAttachmentText(part.join('\n'))}`;
        facts.push(countFact(`attachment:${found.id}:lines`, `linhas de ${found.name}`, total), ...textValueFacts(`attachment:${found.id}:t${offset}`, part.join('\n')));
      }
      const next = offset + returned < total ? offset + returned : null;
      const footer = next === null ? 'Fim do anexo.' : `Há mais: use offset=${next}.`;
      return buildToolResult({
        tool: READ_ATTACHMENT_TOOL,
        body: `${body}\n${footer}`,
        facts,
        summary: { tool: READ_ATTACHMENT_TOOL, label, filters: { offset: String(offset), limit: String(limit) }, itemCount: returned, truncated: next !== null },
        maxChars: Math.min(ATTACHMENT_LIMITS.maxModelTextChars, 12_000),
      });
    },
  };
}
