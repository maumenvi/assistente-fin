import { type CapabilityRequestedEvent } from './capability.requested.event.ts';
import { type FileEditConfirmationRequestedEvent } from './file.edit.confirmation.requested.event.ts';
import { type FileRequestResolvedEvent } from './file.request.resolved.event.ts';
import { type FolderPermissionRequestedEvent } from './folder.permission.requested.event.ts';
import { type MessageReplacedEvent } from './message.replaced.event.ts';
import { type NodeFinishedEvent } from './node.finished.event.ts';
import { type NodeStartedEvent } from './node.started.event.ts';
import { type NoticeEvent } from './notice.event.ts';
import { type PlanUpdatedEvent } from './plan.updated.event.ts';
import { type PreferenceSuggestedEvent } from './preference.suggested.event.ts';
import { type QueryCardEvent } from './query.card.event.ts';
import { type ReportSavedEvent } from './report.saved.event.ts';
import { type RunFinishedEvent } from './run.finished.event.ts';
import { type RunStartedEvent } from './run.started.event.ts';
import { type StepRecordedEvent } from './step.recorded.event.ts';
import { type SummaryUpdatedEvent } from './summary.updated.event.ts';
import { type TextDeltaEvent } from './text.delta.event.ts';
import { type UsageEvent } from './usage.event.ts';

/** Evento em memoria que alimenta a UI ao vivo (independente de qualquer gravacao). */
export type AgentEvent =
  | RunStartedEvent
  | NodeStartedEvent
  | NodeFinishedEvent
  | TextDeltaEvent
  | QueryCardEvent
  | NoticeEvent
  | StepRecordedEvent
  | UsageEvent
  | MessageReplacedEvent
  | PreferenceSuggestedEvent
  | PlanUpdatedEvent
  | CapabilityRequestedEvent
  | FolderPermissionRequestedEvent
  | FileEditConfirmationRequestedEvent
  | FileRequestResolvedEvent
  | ReportSavedEvent
  | SummaryUpdatedEvent
  | RunFinishedEvent;
