import { RunCancelledError } from '../../../domain/agent/errors/run.cancelled.error.ts';
import { type ModelCapabilities } from '../../../domain/agent/model.capabilities.ts';
import { type LlmEvent } from '../../../app/agent/ports/llm/llm.event.ts';
import { type LlmPort } from '../../../app/agent/ports/llm/llm.port.ts';
import { type LlmRequest } from '../../../app/agent/ports/llm/llm.request.ts';
import { sleep } from '../sleep.ts';
import { buildReplayError } from './build.replay.error.ts';
import { type ReplayTurn } from './replay.turn.ts';

/**
 * `LlmPort` que reproduz respostas gravadas (spec 031, D21): usado nos testes e nas avaliacoes
 * offline. A i-esima chamada a `stream` toca a i-esima resposta (a ultima se repete). Guarda os
 * pedidos recebidos em `requests` para os testes conferirem o que o agente enviou.
 */
export class ReplayLlm implements LlmPort {
  public readonly capabilities: ModelCapabilities;
  public readonly requests: LlmRequest[] = [];
  private readonly turns: readonly ReplayTurn[];
  private next = 0;

  public constructor(capabilities: ModelCapabilities, turns: readonly ReplayTurn[]) {
    if (turns.length === 0) throw new Error('ReplayLlm precisa de ao menos uma resposta gravada');
    this.capabilities = capabilities;
    this.turns = turns;
  }

  public stream(request: LlmRequest, signal?: AbortSignal): AsyncIterable<LlmEvent> {
    this.requests.push(request);
    const turn = this.turns[Math.min(this.next, this.turns.length - 1)] as ReplayTurn;
    this.next += 1;
    return this.play(turn, signal);
  }

  private async *play(turn: ReplayTurn, signal: AbortSignal | undefined): AsyncGenerator<LlmEvent, void, undefined> {
    let emitted = false;
    for (const event of turn.events) {
      if (signal?.aborted) throw new RunCancelledError();
      if (turn.delayMs !== undefined && turn.delayMs > 0) await sleep(turn.delayMs, signal);
      if (event.type === 'text_delta' || event.type === 'tool_call') emitted = true;
      yield event;
    }
    if (signal?.aborted) throw new RunCancelledError();
    if (turn.error) throw buildReplayError(turn.error, emitted);
  }
}
