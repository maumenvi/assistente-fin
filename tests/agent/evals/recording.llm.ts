import { type LlmEvent } from '../../../src/app/agent/ports/llm/llm.event.ts';
import { type LlmPort } from '../../../src/app/agent/ports/llm/llm.port.ts';
import { type LlmRequest } from '../../../src/app/agent/ports/llm/llm.request.ts';
import { type ReplayFixture } from '../../../src/libs/llm/replay/replay.fixture.schema.ts';

/** Envolve um modelo real e guarda os eventos de cada chamada para virarem uma fixture (`--record`). */
export class RecordingLlm implements LlmPort {
  public readonly capabilities: LlmPort['capabilities'];
  private readonly inner: LlmPort;
  private readonly turns: ReplayFixture['turns'] = [];

  public constructor(inner: LlmPort) {
    this.inner = inner;
    this.capabilities = inner.capabilities;
  }

  public stream(request: LlmRequest, signal?: AbortSignal): AsyncIterable<LlmEvent> {
    const events: LlmEvent[] = [];
    const turns = this.turns;
    const source = this.inner.stream(request, signal);
    return (async function* () {
      for await (const event of source) {
        events.push(event);
        yield event;
      }
      turns.push({ events: events as ReplayFixture['turns'][number]['events'] });
    })();
  }

  /** Fixture com todas as respostas gravadas ate agora. */
  public fixture(): ReplayFixture {
    return { version: 1, turns: this.turns.length > 0 ? this.turns : [{ events: [{ type: 'finish', reason: 'stop' }] }] };
  }
}
