import { type AgentMetricFilter, type AgentMetricStorePort } from '../../app/agent/ports/store/agent.metric.store.port.ts';
import { type AgentMetricRecord } from '../../domain/agent/metrics/agent.metric.record.ts';
import { type FakeAgentData } from './agent.fake.data.ts';

/** Implementacao em memoria de `AgentMetricStorePort` (spec 038, FR-019). */
export class FakeAgentMetricStore implements AgentMetricStorePort {
  private readonly data: FakeAgentData;

  public constructor(data: FakeAgentData) {
    this.data = data;
  }

  public async append(record: AgentMetricRecord): Promise<void> {
    this.data.metrics.set(record.id, { ...record });
  }

  public async listByUser(userId: string, filter?: AgentMetricFilter): Promise<readonly AgentMetricRecord[]> {
    const result: AgentMetricRecord[] = [];
    for (const record of this.data.metrics.values()) {
      if (record.userId !== userId) continue;
      if (filter?.fromIso !== undefined && record.createdAt < filter.fromIso) continue;
      if (filter?.toIso !== undefined && record.createdAt > filter.toIso) continue;
      if (filter?.strategy !== undefined && record.strategy !== filter.strategy) continue;
      if (filter?.model !== undefined && record.model !== filter.model) continue;
      if (filter?.conversationId !== undefined && record.conversationId !== filter.conversationId) continue;
      result.push(record);
    }
    return result.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
}

