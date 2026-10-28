import { z } from 'zod';
import { type AgentTool } from '../../tools/agent.tool.ts';
import { buildMemoryResult } from './build.memory.result.ts';
import { describePreference } from './describe.preference.ts';
import { type MemoryToolDeps } from './memory.tool.deps.ts';

const inputSchema = z.object({});

type Args = z.infer<typeof inputSchema>;

/**
 * `list_preferences` (spec 032, US3 cenario 4): o que o assistente guarda, fiel a tela (estado,
 * escopo, origem, privacidade). Com modelo de nuvem as PRIVADAS nao entram na lista - so a contagem,
 * para o usuario ver o resto na tela (FR-023).
 */
export function listPreferencesTool(deps: MemoryToolDeps): AgentTool<Args> {
  return {
    id: 'list_preferences',
    description: 'Lista as preferências que o assistente guarda sobre o usuário. Use quando ele perguntar "o que você sabe sobre mim?" ou pedir para ver as preferências.',
    effect: 'memory',
    input: inputSchema,
    async run(_args, ctx) {
      const all = (await deps.stores.preferences.list(ctx.userId)).filter((p) => p.status !== 'disabled');
      const entities = await deps.entities(ctx.userId);
      const label = (p: (typeof all)[number]): string => {
        if (p.scope.kind === 'global') return 'global';
        const found = (p.scope.kind === 'account' ? entities.accounts : entities.categories).find((e) => e.id === (p.scope as { id: string }).id);
        return `${p.scope.kind === 'account' ? 'conta' : 'categoria'} ${found?.name ?? 'removida'}`;
      };
      const hidden = ctx.cloud === true ? all.filter((p) => p.private) : [];
      const shown = (ctx.cloud === true ? all.filter((p) => !p.private) : all).slice(0, ctx.limits.maxItems);
      const lines = shown.map((p) => describePreference(p, label(p)));
      const extra = hidden.length > 0 ? `\n${hidden.length} preferência(s) privada(s) não aparecem aqui porque o modelo é da nuvem; diga ao usuário que ele as vê na tela de preferências.` : '';
      const body = all.length === 0 ? 'Nenhuma preferência guardada ainda.' : `Total: ${all.length} preferências\n${lines.join('\n')}${extra}`;
      return buildMemoryResult('list_preferences', body, all.length, ctx.limits.maxChars);
    },
  };
}
