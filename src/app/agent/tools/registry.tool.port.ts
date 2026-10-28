import { type ToolPort } from '../ports/tool/tool.port.ts';
import { type ToolContext } from '../ports/tool/tool.context.ts';
import { type ToolInvocation } from '../ports/tool/tool.invocation.ts';
import { type ToolResult } from '../ports/tool/tool.result.ts';
import { type ToolSpec } from '../ports/llm/tool.spec.ts';
import { buildToolError } from './shared/build.tool.error.ts';
import { type ToolRegistry } from './tool.registry.ts';

/** Resume os problemas de validacao do Zod em uma frase curta em pt-BR (volta ao modelo). */
function describeIssues(issues: readonly { path: PropertyKey[]; message: string }[]): string {
  const text = issues
    .slice(0, 3)
    .map((issue) => (issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message))
    .join('; ');
  return `argumentos invalidos (${text})`.slice(0, 240);
}

/**
 * `ToolPort` sobre um `ToolRegistry` (spec 031): valida os argumentos com o Zod da ferramenta,
 * aplica o tempo limite e NUNCA lanca - qualquer falha volta como `ToolResult` com `error`.
 */
export class RegistryToolPort implements ToolPort {
  private readonly registry: ToolRegistry;
  private readonly timeoutMs: number | undefined;

  /** `timeoutMs` troca o limite padrao do contexto (ferramentas que esperam a pessoa, como as de arquivo, spec 040). */
  public constructor(registry: ToolRegistry, options: { readonly timeoutMs?: number } = {}) {
    this.registry = registry;
    this.timeoutMs = options.timeoutMs;
  }

  public list(): readonly ToolSpec[] {
    return this.registry.list();
  }

  public async execute(call: ToolInvocation, ctx: ToolContext, signal?: AbortSignal): Promise<ToolResult> {
    const tool = this.registry.get(call.name);
    if (tool === undefined) return buildToolError(call.name, { code: 'not_found', message: `ferramenta "${call.name}" nao existe` });
    const parsed = tool.input.safeParse(call.args ?? {});
    if (!parsed.success) return buildToolError(call.name, { code: 'invalid_args', message: describeIssues(parsed.error.issues) });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<'timeout'>((resolve) => {
        timer = setTimeout(() => resolve('timeout'), this.timeoutMs ?? ctx.limits.timeoutMs);
      });
      const outcome = await Promise.race([tool.run(parsed.data as never, ctx, signal), timeout]);
      if (outcome === 'timeout') return buildToolError(call.name, { code: 'timeout', message: 'a consulta demorou demais' });
      return { ...outcome, facts: outcome.facts.map((fact) => ({ ...fact, sourceCallId: call.id })) };
    } catch {
      return buildToolError(call.name, { code: 'failed', message: 'a consulta falhou' });
    } finally {
      clearTimeout(timer);
    }
  }
}
