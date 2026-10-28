import { type AgentRun } from '../../domain/agent/agent.run.ts';
import { type AgentRunSummary } from '../../app/agent/ports/store/agent.run.summary.ts';
import { type RunCheckpoint } from '../../app/agent/ports/store/run.checkpoint.ts';
import { type RunFinish } from '../../app/agent/ports/store/run.finish.ts';
import { type RunListFilter } from '../../app/agent/ports/store/run.list.filter.ts';
import { type RunStorePort } from '../../app/agent/ports/store/run.store.port.ts';
import { type FakeAgentData } from './agent.fake.data.ts';

/** Execucoes do agente em memoria. */
export class FakeRunStore implements RunStorePort {
  private readonly data: FakeAgentData;

  public constructor(data: FakeAgentData) {
    this.data = data;
  }

  public create(run: AgentRun): Promise<void> {
    this.data.runs.set(run.id, structuredClone(run));
    return Promise.resolve();
  }

  public saveCheckpoint(userId: string, id: string, checkpoint: RunCheckpoint): Promise<void> {
    const found = this.data.runs.get(id);
    if (found && found.userId === userId) {
      this.data.runs.set(id, structuredClone({ ...found, ...checkpoint }));
    }
    return Promise.resolve();
  }

  public finish(userId: string, id: string, finish: RunFinish): Promise<void> {
    const found = this.data.runs.get(id);
    if (found && found.userId === userId) {
      this.data.runs.set(id, structuredClone({ ...found, ...finish, currentNode: null }));
    }
    return Promise.resolve();
  }

  public get(userId: string, id: string): Promise<AgentRun | null> {
    const found = this.data.runs.get(id);
    return Promise.resolve(found && found.userId === userId ? structuredClone(found) : null);
  }

  public list(userId: string, filter: RunListFilter): Promise<AgentRunSummary[]> {
    const rows = [...this.data.runs.values()]
      .filter(
        (r) =>
          r.userId === userId &&
          (filter.status === undefined || r.status === filter.status) &&
          (filter.model === undefined || r.model === filter.model) &&
          (filter.before === undefined || r.startedAt < filter.before),
      )
      .sort((a, b) => (a.startedAt === b.startedAt ? b.id.localeCompare(a.id) : b.startedAt.localeCompare(a.startedAt)))
      .slice(0, filter.limit)
      .map((run): AgentRunSummary => this.summarize(run));
    return Promise.resolve(structuredClone(rows));
  }

  public markStaleInterrupted(userId: string, olderThan: string): Promise<AgentRun[]> {
    const touched: AgentRun[] = [];
    for (const run of this.data.runs.values()) {
      if (run.userId !== userId || run.status !== 'running' || run.heartbeatAt >= olderThan) continue;
      const interrupted: AgentRun = { ...run, status: 'interrupted', endedAt: run.heartbeatAt };
      this.data.runs.set(run.id, interrupted);
      touched.push(interrupted);
    }
    return Promise.resolve(structuredClone(touched));
  }

  public deleteAll(userId: string): Promise<void> {
    for (const run of [...this.data.runs.values()]) {
      if (run.userId !== userId) continue;
      this.data.runs.delete(run.id);
      this.data.steps.delete(run.id);
    }
    return Promise.resolve();
  }

  private summarize(run: AgentRun): AgentRunSummary {
    const userMessage = this.data.messages.get(run.conversationId)?.find((m) => m.id === run.userMessageId);
    const firstText = userMessage?.parts.find((p) => p.type === 'text');
    const question = firstText?.type === 'text' ? (firstText.text.split('\n')[0] ?? '') : '';
    return {
      id: run.id,
      conversationId: run.conversationId,
      question,
      status: run.status,
      intent: run.intent,
      consumed: run.consumed,
      profileIds: run.profileIds,
      model: run.model,
      startedAt: run.startedAt,
      endedAt: run.endedAt,
      errorCode: run.errorCode,
    };
  }
}
