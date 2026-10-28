import { type RunStep } from '../../domain/agent/run.step.ts';
import { type StepStorePort } from '../../app/agent/ports/store/step.store.port.ts';
import { type FakeAgentData } from './agent.fake.data.ts';

/** Passos executados em memoria; idempotente por `(runId, seq)`. */
export class FakeStepStore implements StepStorePort {
  private readonly data: FakeAgentData;

  public constructor(data: FakeAgentData) {
    this.data = data;
  }

  public appendMany(userId: string, steps: readonly RunStep[]): Promise<void> {
    for (const step of steps) {
      const run = this.data.runs.get(step.runId);
      if (!run || run.userId !== userId) continue;
      const list = (this.data.steps.get(step.runId) ?? []).filter((s) => s.seq !== step.seq);
      list.push(structuredClone(step));
      list.sort((a, b) => a.seq - b.seq);
      this.data.steps.set(step.runId, list);
    }
    return Promise.resolve();
  }

  public list(userId: string, runId: string): Promise<RunStep[]> {
    const run = this.data.runs.get(runId);
    if (!run || run.userId !== userId) return Promise.resolve([]);
    return Promise.resolve(structuredClone(this.data.steps.get(runId) ?? []));
  }
}
