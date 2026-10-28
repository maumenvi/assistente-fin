/** Em que pé está uma conversa para quem olha de fora (ícone de chat, bandeja, notificações; spec 040). */
export type ActivityState = 'running' | 'awaiting_user' | 'completed' | 'interrupted' | 'failed';

/**
 * Por que uma conversa espera a pessoa: plano ou capacidade para aprovar, limite da execução, pasta para liberar ou edição de
 * arquivo para aprovar (nestes dois a execução fica parada até a decisão, spec 040).
 */
export type AwaitReason = 'plan' | 'capability' | 'limit' | 'folder_permission' | 'file_edit';

/** Estado resumido de uma conversa com atividade nesta sessão do app. */
export interface ConversationActivity {
  readonly conversationId: string;
  readonly state: ActivityState;
  readonly reason: AwaitReason | null;
  readonly updatedAt: string;
}
