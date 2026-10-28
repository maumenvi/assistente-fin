import { type AfterTurnContext } from './after.turn.context.ts';

/**
 * Tarefa que roda DEPOIS de a resposta ser entregue (aprendizado, compactacao - spec 032). Recebe um
 * `signal` que aborta quando a sessao do usuario termina; pode lancar - o hook engole e registra.
 */
export interface AfterTurnTask {
  readonly name: string;
  run(ctx: AfterTurnContext, signal: AbortSignal): Promise<void>;
}
