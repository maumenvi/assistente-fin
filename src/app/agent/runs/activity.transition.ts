import { type ActivityState, type AwaitReason } from '../../../domain/agent/conversation.activity.ts';

/** Mudança de estado de uma conversa: o que notificações e bandeja escutam. */
export interface ActivityTransition {
  readonly conversationId: string;
  readonly from: ActivityState | null;
  readonly to: ActivityState;
  readonly reason: AwaitReason | null;
}
