import { z } from 'zod';
import { parseQualifiedName } from '../../../../domain/capability/lifecycle/qualified.name.ts';
import { type Fact } from '../../../../domain/agent/fact.ts';
import { type AgentTool } from '../../tools/agent.tool.ts';
import { buildToolError } from '../../tools/shared/build.tool.error.ts';
import { sanitizeText } from '../../tools/shared/sanitize.text.ts';
import { type ToolResult } from '../../ports/tool/tool.result.ts';
import { checkEgress } from '../safety/egress.guard.ts';
import { validateArgs } from '../safety/validate.args.ts';
import { MAX_EXTERNAL_CALLS_PER_RUN, PerRunCounter, recordUse, sourceOf, type CapabilityToolDeps } from './capability.tool.deps.ts';
import { type ToolContext } from '../../ports/tool/tool.context.ts';
import { externalResult } from './external.result.ts';
import { usableCapability } from './list.capability.tools.tool.ts';

async function recentText(deps: CapabilityToolDeps, ctx: ToolContext): Promise<string> {
  const conversationId = ctx.source?.conversationId;
  if (deps.recentUserText === undefined || conversationId === undefined) return '';
  try {
    return await deps.recentUserText(ctx.userId, conversationId);
  } catch {
    return '';
  }
}

const inputSchema = z.object({
  name: z.string().trim().min(3).max(120).describe('Nome qualificado "slug.ferramenta", como em list_capability_tools (ex.: "cambio.convert").'),
  arguments: z.record(z.string(), z.unknown()).default({}).describe('Argumentos da ferramenta, conforme os campos listados. Só envie dados que o usuário citou ou que uma consulta já trouxe.'),
});
type Args = z.infer<typeof inputSchema>;

/**
 * `call_capability_tool` (spec 034, FR-005/FR-009/FR-010): chama UMA ferramenta de uma capacidade ativa. Antes: capacidade
 * ativa e ainda igual ao que foi aprovado, argumentos validos no schema fixado e barreira de saida (so sai o que o
 * usuario disse ou o app ja consultou). Depois: resultado vira DADO (envelope, segredos redigidos, injecao marcada,
 * fatos extraidos) e a chamada e registrada no historico.
 */
export function callCapabilityTool(deps: CapabilityToolDeps): AgentTool<Args> {
  const counter = new PerRunCounter();
  return {
    id: 'call_capability_tool',
    description: 'Chama uma ferramenta de uma capacidade conectada (veja list_capability_tools). Dados enviados saem do aparelho: envie só o que o usuário pediu. Nunca envie dados do app que ele não citou.',
    effect: 'external',
    input: inputSchema,
    async run(args, ctx, signal) {
      const toolId = 'call_capability_tool';
      const parsed = parseQualifiedName(args.name);
      if (parsed === null) return buildToolError(toolId, { code: 'invalid_args', message: 'use o nome qualificado "slug.ferramenta"' });
      const usable = await usableCapability(deps, ctx, parsed.slug, toolId);
      if ('error' in usable) return usable.error;
      const { capability } = usable;
      if (capability.kind !== 'mcp') return buildToolError(toolId, { code: 'invalid_args', message: `"${capability.slug}" e uma skill de instrucoes; use read_skill` });
      if (!counter.take(ctx.turn?.runId ?? 'sem-execucao', MAX_EXTERNAL_CALLS_PER_RUN)) return buildToolError(toolId, { code: 'failed', message: 'limite de chamadas externas desta resposta atingido; responda com o que ja foi apurado' });

      const acquired = await deps.runtime.acquire(capability, sourceOf(ctx));
      if (acquired.status === 'changed') return { ...buildToolError(toolId, { code: 'failed', message: `a capacidade "${capability.slug}" mudou depois da aprovacao; o usuario precisa aprovar de novo` }), capabilityRequestIds: [acquired.requestId] };
      if (acquired.status === 'unavailable') return buildToolError(toolId, { code: 'failed', message: `a capacidade "${capability.slug}" esta indisponivel agora: ${acquired.reason}` });
      const tool = acquired.tools.find((t) => t.name === parsed.tool);
      const qualified = args.name;
      const base = { capabilityId: capability.id, tool: qualified, resultBytes: 0, durationMs: 0, errorCode: null, suspectedInjection: false } as const;
      if (tool === undefined) return buildToolError(toolId, { code: 'not_found', message: `a capacidade nao tem a ferramenta "${parsed.tool}"; use list_capability_tools` });

      const secrets = await deps.engine.vault.valuesOf(capability.credentialRefs);
      const verdict = validateArgs(tool.inputSchema, args.arguments);
      if (verdict.status === 'invalid') {
        await recordUse(deps, ctx, { ...base, args: args.arguments, secrets, resultSummary: `argumentos recusados: ${verdict.reason}`, ok: false, errorCode: 'invalid_args', blocked: 'schema' });
        return { ...buildToolError(toolId, { code: 'invalid_args', message: `argumentos invalidos: ${verdict.reason}` }), external: { capability: capability.slug, suspectedInjection: false, blocked: 'schema' as const } };
      }
      const knownFacts: Fact[] = (ctx.turn?.knownMoneyCents ?? []).map((cents, i) => ({ id: `k${String(i)}`, kind: 'money' as const, value: cents, display: '', label: '', sourceCallId: '' }));
      const egress = checkEgress(args.arguments, { userText: [ctx.turn?.userText ?? '', await recentText(deps, ctx)].join('\n'), facts: knownFacts, now: deps.engine.clock.now() });
      if (!egress.ok) {
        await recordUse(deps, ctx, { ...base, args: args.arguments, secrets, resultSummary: `nao enviada: ${egress.reason}`, ok: false, errorCode: egress.blocked, blocked: egress.blocked });
        return { ...buildToolError(toolId, { code: 'failed', message: `chamada bloqueada pelo app: ${egress.reason}` }), external: { capability: capability.slug, suspectedInjection: false, blocked: egress.blocked } };
      }

      const started = deps.engine.clock.now().getTime();
      try {
        const out = await deps.engine.mcp.callTool(acquired.connection, parsed.tool, args.arguments, signal);
        const elapsed = Math.max(0, deps.engine.clock.now().getTime() - started);
        const shaped = externalResult({ tool: qualified, origin: `capacidade:${capability.slug}`, label: `${capability.name}: ${sanitizeText(parsed.tool, 40)}`, text: out.text, secrets, maxChars: ctx.limits.maxChars, isError: out.isError });
        await recordUse(deps, ctx, { ...base, args: args.arguments, secrets, resultSummary: shaped.resultSummary, resultBytes: shaped.bytes, durationMs: elapsed, ok: !out.isError, errorCode: out.isError ? 'tool_error' : null, suspectedInjection: shaped.suspectedInjection, blocked: null });
        await deps.engine.stores.capabilities.save({ ...capability, lastUsedAt: deps.engine.clock.now().toISOString() });
        return { ...shaped.result, external: { capability: capability.slug, suspectedInjection: shaped.suspectedInjection, blocked: null } } satisfies ToolResult;
      } catch (error) {
        deps.runtime.forget(capability.id);
        const reason = error instanceof Error ? error.message : 'falhou';
        await recordUse(deps, ctx, { ...base, args: args.arguments, secrets, resultSummary: sanitizeText(reason, 160), durationMs: Math.max(0, deps.engine.clock.now().getTime() - started), ok: false, errorCode: 'call_failed', blocked: null });
        return buildToolError(toolId, { code: 'failed', message: `a capacidade nao respondeu: ${sanitizeText(reason, 120)}` });
      }
    },
  };
}
