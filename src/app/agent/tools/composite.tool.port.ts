import { type ToolSpec } from '../ports/llm/tool.spec.ts';
import { type ToolContext } from '../ports/tool/tool.context.ts';
import { type ToolInvocation } from '../ports/tool/tool.invocation.ts';
import { type ToolPort } from '../ports/tool/tool.port.ts';
import { type ToolResult } from '../ports/tool/tool.result.ts';
import { buildToolError } from './shared/build.tool.error.ts';

/** Junta portas de ferramentas: o modelo ve todas; cada chamada vai para a porta que a possui (a primeira da lista vence em empate). */
export class CompositeToolPort implements ToolPort {
  private readonly ports: readonly ToolPort[];

  public constructor(ports: readonly ToolPort[]) {
    this.ports = ports;
  }

  public list(): readonly ToolSpec[] {
    const seen = new Set<string>();
    return this.ports.flatMap((p) => p.list()).filter((spec) => !seen.has(spec.name) && seen.add(spec.name));
  }

  public execute(call: ToolInvocation, ctx: ToolContext, signal?: AbortSignal): Promise<ToolResult> {
    const owner = this.ports.find((p) => p.list().some((spec) => spec.name === call.name));
    if (owner === undefined) return Promise.resolve(buildToolError(call.name, { code: 'not_found', message: `ferramenta "${call.name}" nao existe` }));
    return owner.execute(call, ctx, signal);
  }
}
