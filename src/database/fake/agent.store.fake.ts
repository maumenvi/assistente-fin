import { type AgentStorePort } from '../../app/agent/ports/store/agent.store.port.ts';
import { type ConversationStorePort } from '../../app/agent/ports/store/conversation.store.port.ts';
import { type MessageStorePort } from '../../app/agent/ports/store/message.store.port.ts';
import { type RunStorePort } from '../../app/agent/ports/store/run.store.port.ts';
import { type StepStorePort } from '../../app/agent/ports/store/step.store.port.ts';
import { type SummaryStorePort } from '../../app/agent/ports/store/summary.store.port.ts';
import { type AgentMetricStorePort } from '../../app/agent/ports/store/agent.metric.store.port.ts';
import { type AttachmentStorePort } from '../../app/agent/attachment/ports/attachment.store.port.ts';
import { FakeAgentData } from './agent.fake.data.ts';
import { FakeAttachmentStore } from './agent.attachment.store.fake.ts';
import { FakeAgentMetricStore } from './agent.metric.store.fake.ts';
import { FakeConversationStore } from './conversation.store.fake.ts';
import { FakeMessageStore } from './message.store.fake.ts';
import { FakeRunStore } from './run.store.fake.ts';
import { FakeStepStore } from './step.store.fake.ts';
import { FakeSummaryStore } from './summary.store.fake.ts';

/** Armazenamento do agente em memoria (testes, avaliacoes e desenvolvimento offline). */
export class FakeAgentStore implements AgentStorePort {
  public readonly conversations: ConversationStorePort;
  public readonly messages: MessageStorePort;
  public readonly runs: RunStorePort;
  public readonly steps: StepStorePort;
  public readonly summaries: SummaryStorePort;
  public readonly attachments: AttachmentStorePort;
  public readonly metrics: AgentMetricStorePort;

  public constructor() {
    const data = new FakeAgentData();
    this.conversations = new FakeConversationStore(data);
    this.messages = new FakeMessageStore(data);
    this.runs = new FakeRunStore(data);
    this.steps = new FakeStepStore(data);
    this.summaries = new FakeSummaryStore(data);
    this.attachments = new FakeAttachmentStore(data);
    this.metrics = new FakeAgentMetricStore(data);
  }
}
