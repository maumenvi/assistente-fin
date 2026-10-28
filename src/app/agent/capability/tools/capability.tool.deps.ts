import { type CapabilityUse } from '../../../../domain/capability/capability.use.ts';
import { type CapabilityEngineDeps } from '../engine/engine.deps.ts';
import { type CapabilityRuntime } from '../engine/capability.runtime.ts';
import { type ToolContext } from '../../ports/tool/tool.context.ts';
import { redactSecrets } from '../safety/redact.secrets.ts';

/** Maximo de chamadas externas por resposta (SC: o agente nao varre um servico em loop). */
export const MAX_EXTERNAL_CALLS_PER_RUN = 3;
/** Maximo de pedidos de capacidade por resposta. */
export const MAX_REQUESTS_PER_RUN = 2;

export interface CapabilityToolDeps {
  readonly engine: CapabilityEngineDeps;
  readonly runtime: CapabilityRuntime;
  /**
   * Texto que o usuario escreveu nas mensagens recentes da conversa. A barreira de saida aceita o que ele disse AQUI
   * tambem: depois de aprovar, a retomada ("Continue o pedido anterior") nao repete o valor do pedido original.
   */
  readonly recentUserText?: ((userId: string, conversationId: string) => Promise<string>) | undefined;
}

/** Contador por execucao (limpa sozinho: guarda so as ultimas execucoes). */
export class PerRunCounter {
  private readonly counts = new Map<string, number>();

  /** Soma 1 e devolve se ainda cabe no limite. */
  public take(runId: string, limit: number): boolean {
    const next = (this.counts.get(runId) ?? 0) + 1;
    if (this.counts.size > 100) this.counts.clear();
    this.counts.set(runId, next);
    return next <= limit;
  }
}

export interface RunSourceOf {
  readonly conversationId: string;
  readonly runId: string | null;
  readonly messageId: string | null;
}

/** De onde veio a chamada (para ligar pedidos e usos a execucao). */
export function sourceOf(ctx: ToolContext): RunSourceOf {
  return { conversationId: ctx.source?.conversationId ?? '', runId: ctx.turn?.runId ?? null, messageId: ctx.turn?.assistantMessageId ?? null };
}

/** Grava o uso (nunca quebra a chamada; argumentos redigidos e cortados). */
export async function recordUse(deps: CapabilityToolDeps, ctx: ToolContext, use: Omit<CapabilityUse, 'id' | 'userId' | 'runId' | 'at' | 'argsJson'> & { readonly args: unknown; readonly secrets: readonly string[] }): Promise<void> {
  try {
    const { args, secrets, ...rest } = use;
    await deps.engine.stores.uses.append({ ...rest, id: deps.engine.ids.next(), userId: ctx.userId, runId: ctx.turn?.runId ?? null, at: deps.engine.clock.now().toISOString(), argsJson: redactSecrets(JSON.stringify(args ?? {}), secrets).slice(0, 1000) });
  } catch {
    // o historico nunca derruba a chamada
  }
}
