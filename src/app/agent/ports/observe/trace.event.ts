import { type Consumed } from '../../../../domain/agent/consumed.ts';
import { type RunStatus } from '../../../../domain/agent/run.status.ts';
import { type RunStep } from '../../../../domain/agent/run.step.ts';
import { type AgentRunSummary } from '../store/agent.run.summary.ts';

/** Evento de observacao enviado ao trace (FR-036). */
export type TraceEvent =
  | { readonly type: 'run_started'; readonly userId: string; readonly run: AgentRunSummary }
  | { readonly type: 'step'; readonly userId: string; readonly step: RunStep }
  | {
      readonly type: 'run_finished';
      readonly userId: string;
      readonly runId: string;
      readonly conversationId: string;
      readonly status: RunStatus;
      readonly consumed: Consumed;
      readonly durationMs: number;
      readonly errorCode: string | null;
    };
