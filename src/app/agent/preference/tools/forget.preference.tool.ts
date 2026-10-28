import { z } from 'zod';
import { normalizeText } from '../../../../domain/preference/normalize.text.ts';
import { type Preference } from '../../../../domain/preference/preference.ts';
import { type AgentTool } from '../../tools/agent.tool.ts';
import { buildMemoryResult } from './build.memory.result.ts';
import { type MemoryToolDeps } from './memory.tool.deps.ts';

const inputSchema = z.object({
  id: z.string().trim().min(1).max(100).optional().describe('Id exato da preferência (use quando o usuário escolheu uma da lista).'),
  query: z.string().trim().min(1).max(200).optional().describe('Palavras que identificam a preferência. Vazio ou "isso" = a última aplicada.'),
});

type Args = z.infer<typeof inputSchema>;

const FILLER = new Set(['isso', 'essa', 'esse', 'aquilo', 'aquela', 'preferencia', 'esqueca', 'esquece', 'de', 'da', 'do', 'que', 'eu', 'disse', 'falei', 'sobre', 'a', 'o', 'as', 'os', 'ultima']);

/** Radicais das palavras que identificam a preferencia (sem as de enchimento): "respostas" casa "responder". */
function keywords(query: string): string[] {
  return normalizeText(query)
    .split(' ')
    .filter((w) => w.length >= 3 && !FILLER.has(w))
    .map((w) => (w.length > 5 ? w.slice(0, 5) : w.replace(/s$/, '')));
}

/**
 * `forget_preference` (spec 032, US1 cenario 3): remove uma preferencia. Por `id`, ou por palavras
 * do texto; sem alvo ("esqueca isso") vale a ultima aplicada. Varias candidatas -> nao apaga nada e
 * devolve as opcoes (o usuario escolhe). A remocao e imediata e vale nos dois aparelhos.
 */
export function forgetPreferenceTool(deps: MemoryToolDeps): AgentTool<Args> {
  return {
    id: 'forget_preference',
    description: 'Remove uma preferência quando o usuário pede para esquecer ("esqueça isso", "esqueça a preferência de respostas curtas").',
    effect: 'memory',
    input: inputSchema,
    async run(args, ctx) {
      const done = (body: string, count = 0) => buildMemoryResult('forget_preference', body, count, ctx.limits.maxChars);
      const all = (await deps.stores.preferences.list(ctx.userId)).filter((p) => p.status !== 'disabled');
      let matches: Preference[];
      if (args.id !== undefined) {
        matches = all.filter((p) => p.id === args.id);
      } else {
        const words = keywords(args.query ?? '');
        if (words.length > 0) {
          matches = all.filter((p) => words.every((w) => normalizeText(p.text).includes(w)));
        } else {
          const applied = ctx.source === undefined ? [] : await deps.lastAppliedIds(ctx.userId, ctx.source.conversationId);
          matches = all.filter((p) => applied.includes(p.id));
        }
      }
      if (matches.length === 0) return done('STATUS: nao_encontrada\nNão achei essa preferência. Ofereça listar o que está guardado.');
      if (matches.length > 1) {
        const options = matches.slice(0, ctx.limits.maxItems).map((p) => `- ${p.text} id=${p.id}`).join('\n');
        return done(`STATUS: ambigua\nMais de uma preferência combina. Não apaguei nada. Pergunte qual (e chame de novo com o id):\n${options}`, matches.length);
      }
      const target = matches[0]!;
      await deps.stores.preferences.delete(ctx.userId, target.id);
      return done(`STATUS: removida\nTexto: ${target.text}\nConfirme ao usuário que o assistente deixou de aplicar isso.`, 1);
    },
  };
}
