import { type AgentMessage } from '../../domain/agent/agent.message.ts';
import { type AgentRun } from '../../domain/agent/agent.run.ts';
import { type Conversation } from '../../domain/agent/conversation.ts';
import { type RunStep } from '../../domain/agent/run.step.ts';
import { type Attachment } from '../../domain/agent/attachment/attachment.ts';
import { type AgentMetricRecord } from '../../domain/agent/metrics/agent.metric.record.ts';
import { type ConversationSummary } from '../../domain/agent/summary/conversation.summary.ts';

/** Estado em memoria compartilhado pelos repositorios fake do agente (permite a cascata). */
export class FakeAgentData {
  public readonly conversations = new Map<string, Conversation>();
  public readonly messages = new Map<string, AgentMessage[]>();
  public readonly runs = new Map<string, AgentRun>();
  public readonly steps = new Map<string, RunStep[]>();
  /** Resumo corrente por conversa (spec 032). */
  public readonly summaries = new Map<string, ConversationSummary>();

  /** Anexos por id (spec 036). */
  public readonly attachments = new Map<string, Attachment>();

  /** Metricas permanentes de uso das LLMs (spec 038): nao entram em `cascadeDelete`. */
  public readonly metrics = new Map<string, AgentMetricRecord>();

  /** Remove uma conversa e tudo que depende dela. */
  public cascadeDelete(conversationId: string): void {
    this.conversations.delete(conversationId);
    this.messages.delete(conversationId);
    this.summaries.delete(conversationId);
    for (const [id, a] of [...this.attachments]) if (a.conversationId === conversationId) this.attachments.delete(id);
    for (const [runId, run] of [...this.runs]) {
      if (run.conversationId !== conversationId) continue;
      this.runs.delete(runId);
      this.steps.delete(runId);
    }
  }
}
