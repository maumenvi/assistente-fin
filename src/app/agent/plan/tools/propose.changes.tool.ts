import { z } from 'zod';
import { formatBrl } from '../../verify/format.brl.ts';
import { type AgentTool } from '../../tools/agent.tool.ts';
import { buildToolError } from '../../tools/shared/build.tool.error.ts';
import { countFact } from '../../tools/shared/count.fact.ts';
import { moneyFact } from '../../tools/shared/money.fact.ts';
import { type AttachmentStorePort } from '../../attachment/ports/attachment.store.port.ts';
import { attachmentAmountsCents } from '../../attachment/model/attachment.amounts.ts';
import { type PlanService } from '../engine/plan.service.ts';
import { operationUnionSchema } from '../operations/operation.registry.ts';

const MAX_OPERATIONS_PER_CALL = 100;

const inputSchema = z.object({
  summary: z.string().trim().min(3).max(200).describe('Frase curta do que o plano faz, ex.: "Lancar 1 despesa de R$ 87,50".'),
  operations: z.array(operationUnionSchema()).min(1).max(MAX_OPERATIONS_PER_CALL).describe('As alteracoes pedidas, uma por item. Valores em centavos inteiros; datas AAAA-MM-DD.'),
  attachmentId: z.string().trim().min(1).optional().describe('Id do anexo (bloco <dado_externo origem="anexo" id="...">) de onde vem os itens, quando o pedido e lancar o conteudo de um arquivo ou imagem.'),
  replaces: z.string().trim().min(1).optional().describe('Id de um plano ainda pendente que este substitui (quando o usuario corrige o pedido).'),
});

type Args = z.infer<typeof inputSchema>;

/**
 * `propose_changes` (spec 033): UNICO caminho de escrita do agente. Nao grava nada: monta, verifica e
 * guarda um plano que o usuario revisa e aprova (ou que a politica de autonomia libera). Devolve ao
 * modelo o estado do plano para ele explicar com palavras, sem dizer que ja gravou.
 */
export function proposeChangesTool(plans: PlanService, attachments?: AttachmentStorePort): AgentTool<Args> {
  return {
    id: 'propose_changes',
    description:
      'Propoe alteracoes nos dados do usuario (lancar, editar, classificar, excluir, criar/renomear categoria, ganho, gasto fixo, transferencia, pagamento de fatura). Nao grava: cria um plano para o usuario aprovar. Use SO com valores que o usuario escreveu ou que voce consultou. Chame uma vez com todas as operacoes do pedido.',
    effect: 'write',
    input: inputSchema,
    async run(args, ctx) {
      const turn = ctx.turn;
      if (turn === undefined || ctx.source === undefined) return buildToolError('propose_changes', { code: 'failed', message: 'sem contexto de conversa para criar o plano' });
      // itens vindos de anexo: o anexo precisa ser do usuario; os valores que estao no arquivo contam como vistos
      let attachment: { id: string; name: string; fromImage: boolean } | undefined;
      const known = new Set(turn.knownMoneyCents);
      if (args.attachmentId !== undefined) {
        const found = attachments === undefined ? null : await attachments.get(ctx.userId, args.attachmentId);
        if (found === null) return buildToolError('propose_changes', { code: 'invalid_args', message: 'anexo nao encontrado; use o id que aparece no bloco do anexo' });
        attachment = { id: found.id, name: found.name, fromImage: found.kind === 'image' };
        for (const cents of attachmentAmountsCents(found.extracted)) known.add(cents);
      }
      const result = await plans.propose({
        userId: ctx.userId,
        conversationId: ctx.source.conversationId,
        runId: turn.runId,
        messageId: turn.assistantMessageId,
        userText: turn.userText,
        summary: args.summary,
        operations: args.operations.map(({ confidence, ...raw }) => ({ raw, confidence })),
        knownMoneyCents: known,
        replacesPlanId: args.replaces,
        attachment,
      });
      if (!result.ok) {
        const reasons = result.reasons.map((r) => `item ${r.index + 1}: ${r.reason}`).join('; ');
        return buildToolError('propose_changes', { code: 'invalid_args', message: `nenhuma operacao valida (${reasons}). Corrija o que faltou ou pergunte ao usuario.`.slice(0, 600) });
      }
      const { plan, rejected } = result;
      const lines = plan.items.map((i) => `- ${i.label}${i.flags.length > 0 ? ` [alerta: ${i.flags.map((f) => f.text).join('; ')}]` : ''}${i.selected ? '' : ' [desmarcado]'}`);
      const state =
        plan.status === 'applied'
          ? 'Aplicado automaticamente pela politica de autonomia do usuario; ele pode desfazer.'
          : plan.lastError !== null
            ? `Nao foi aplicado: ${plan.lastError}.`
            : 'Plano criado e AGUARDANDO a aprovacao do usuario. Nada foi gravado ainda; nao diga que gravou.';
      const dropped = rejected.length > 0 ? `\nDescartados: ${rejected.map((r) => `item ${r.index + 1} (${r.reason})`).join('; ')}` : '';
      const amounts = plan.items.flatMap((i, n) => (i.amountCents === null ? [] : [moneyFact(`plano.item${n + 1}`, `valor do item ${n + 1} do plano`, i.amountCents)]));
      const facts = plan.items.length > 1 ? [...amounts, countFact('plano.quantidade', 'quantidade de itens do plano', plan.items.length)] : amounts;
      return {
        ok: true,
        contentForModel: `<dados origem="propose_changes">\nPlano ${plan.id}: ${plan.summary}\n${state}\nItens (${plan.items.length}):\n${lines.join('\n')}${dropped}\n</dados>`.slice(0, ctx.limits.maxChars),
        facts,
        summary: { tool: 'propose_changes', label: `plano: ${plan.summary}${plan.items[0] && plan.items.length === 1 ? ` (${plan.items[0].amountCents === null ? '' : formatBrl(plan.items[0].amountCents)})` : ''}`, filters: {}, itemCount: plan.items.length, truncated: false },
        hidden: true,
        plan: { planId: plan.id, status: plan.status },
      };
    },
  };
}
