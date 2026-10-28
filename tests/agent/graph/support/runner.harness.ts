import { type AgentRun } from '../../../../src/domain/agent/agent.run.ts';
import { DEFAULT_RUN_BUDGET } from '../../../../src/domain/agent/default.run.budget.ts';
import { EMPTY_CONSUMED } from '../../../../src/domain/agent/empty.consumed.ts';
import { type RunBudget } from '../../../../src/domain/agent/run.budget.ts';
import { type AgentState } from '../../../../src/app/agent/graph/agent.state.ts';
import { initialAgentState } from '../../../../src/app/agent/graph/initial.agent.state.ts';
import { type RunnerContext } from '../../../../src/app/agent/graph/runner.context.ts';
import { MemoryAgentEvents } from '../../../../src/app/agent/events/memory.agent.events.ts';
import { type AgentEvent } from '../../../../src/app/agent/ports/events/agent.event.ts';
import { type AgentTracePort } from '../../../../src/app/agent/ports/observe/agent.trace.port.ts';
import { type TraceEvent } from '../../../../src/app/agent/ports/observe/trace.event.ts';
import { type AgentStorePort } from '../../../../src/app/agent/ports/store/agent.store.port.ts';
import { FakeAgentStore } from '../../../../src/database/fake/agent.store.fake.ts';
import { MutableClock } from '../../../support/mutable.clock.ts';
import { SequentialIdGenerator } from '../../../support/sequential.id.generator.ts';
import { CollectingAgentLog } from '../../trace/support.ts';
import { makeConversation, makeRun } from '../../store/support/agent.fixtures.ts';

/** Trace que guarda os eventos. */
export class RecordingTrace implements AgentTracePort {
  public readonly events: TraceEvent[] = [];
  public emit(event: TraceEvent): void {
    this.events.push(event);
  }
  public flush(): Promise<void> {
    return Promise.resolve();
  }
}

export interface RunnerHarness {
  readonly ctx: RunnerContext;
  readonly store: AgentStorePort;
  readonly clock: MutableClock;
  readonly events: AgentEvent[];
  readonly trace: RecordingTrace;
  readonly log: CollectingAgentLog;
  readonly controller: AbortController;
  readonly run: AgentRun;
  readonly initial: AgentState;
}

/** Monta um contexto de runner com tudo em memoria; a conversa e a execucao ja existem no store. */
export async function makeRunnerHarness(options: { budget?: RunBudget; store?: AgentStorePort } = {}): Promise<RunnerHarness> {
  const store = options.store ?? new FakeAgentStore();
  await store.conversations.create(makeConversation('c1', 'u1'));
  const run = makeRun('r1', 'c1', 'u1', { consumed: EMPTY_CONSUMED });
  await store.runs.create(run);
  const bus = new MemoryAgentEvents();
  const events: AgentEvent[] = [];
  bus.subscribe((e) => events.push(e));
  const clock = new MutableClock(new Date('2026-10-22T12:00:00Z'));
  const trace = new RecordingTrace();
  const log = new CollectingAgentLog();
  const controller = new AbortController();
  const ctx: RunnerContext = {
    userId: 'u1', conversationId: 'c1', runId: 'r1', store, events: bus, trace, log, clock,
    ids: new SequentialIdGenerator('step'), signal: controller.signal, budget: options.budget ?? DEFAULT_RUN_BUDGET,
    profileIds: { main: 'p-main', fast: null }, mainModel: 'anthropic/claude-sonnet',
  };
  return { ctx, store, clock, events, trace, log, controller, run, initial: initialAgentState('r1') };
}
