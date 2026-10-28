import { type ActivityState, type AwaitReason, type ConversationActivity } from '../../../domain/agent/conversation.activity.ts';
import { type AgentEvent } from '../ports/events/agent.event.ts';
import { type ActivityTransition } from './activity.transition.ts';

interface Pending {
  plan: boolean;
  capability: boolean;
}

/** Códigos de pausa por limite: a execução guardou o progresso e espera "Continuar" (spec 038). */
const LIMIT_CODES = new Set(['BUDGET_EXCEEDED', 'LIMIT_STEPS', 'LIMIT_TOKENS']);

/**
 * Acompanha, pelos eventos do agente, o estado de cada conversa com atividade (spec 040, R6/R7):
 * executando, aguardando a pessoa (plano ou capacidade para aprovar, limite atingido), concluída,
 * interrompida ou com falha. Só em memória: ao reiniciar o app a recuperação marca as órfãs como
 * interrompidas. Conversa aguardando NÃO tem execução ativa, então não ocupa vaga do teto.
 */
export class AgentActivityTracker {
  private readonly byConversation = new Map<string, ConversationActivity>();
  private readonly pending = new Map<string, Pending>();
  /** Pedidos de pasta/edicao a espera da pessoa, por conversa: a execucao esta parada ate decidir (spec 040). */
  private readonly fileRequests = new Map<string, Map<string, AwaitReason>>();
  private readonly listeners = new Set<(transition: ActivityTransition) => void>();
  private readonly now: () => Date;

  public constructor(now: () => Date = () => new Date()) {
    this.now = now;
  }

  /** Inscreve para mudanças de estado; devolve o cancelamento. */
  public onTransition(listener: (transition: ActivityTransition) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Alimenta o rastreador com um evento do agente. */
  public observe(event: AgentEvent): void {
    const id = event.conversationId;
    switch (event.type) {
      case 'run_started':
        this.pending.set(id, { plan: false, capability: false });
        this.set(id, 'running', null);
        return;
      case 'plan_updated':
        if (event.status === 'pending') this.flag(id, 'plan');
        return;
      case 'capability_requested':
        this.flag(id, 'capability');
        return;
      case 'folder_permission_requested':
        this.waitForFile(id, event.requestId, 'folder_permission');
        return;
      case 'file_edit_confirmation_requested':
        this.waitForFile(id, event.requestId, 'file_edit');
        return;
      case 'file_request_resolved':
        this.resolveFile(id, event.requestId);
        return;
      case 'run_finished':
        this.fileRequests.delete(id);
        this.finish(id, event);
        return;
      default:
        return;
    }
  }

  /** Esquece uma conversa (apagada pela pessoa). */
  public forget(conversationId: string): void {
    this.byConversation.delete(conversationId);
    this.pending.delete(conversationId);
    this.fileRequests.delete(conversationId);
  }

  /** Conversas com atividade, as que esperam a pessoa primeiro, depois as executando, depois as mais recentes. */
  public list(): ConversationActivity[] {
    const rank: Record<ActivityState, number> = { awaiting_user: 0, running: 1, failed: 2, interrupted: 2, completed: 3 };
    return [...this.byConversation.values()].sort((a, b) => rank[a.state] - rank[b.state] || b.updatedAt.localeCompare(a.updatedAt));
  }

  public get(conversationId: string): ConversationActivity | undefined {
    return this.byConversation.get(conversationId);
  }

  /** Conversas com execução ativa agora. */
  public runningIds(): string[] {
    return this.list().filter((a) => a.state === 'running').map((a) => a.conversationId);
  }

  private waitForFile(conversationId: string, requestId: string, reason: AwaitReason): void {
    const requests = this.fileRequests.get(conversationId) ?? new Map<string, AwaitReason>();
    requests.set(requestId, reason);
    this.fileRequests.set(conversationId, requests);
    if (this.byConversation.get(conversationId)?.reason !== reason) this.set(conversationId, 'awaiting_user', reason);
  }

  private resolveFile(conversationId: string, requestId: string): void {
    const requests = this.fileRequests.get(conversationId);
    if (requests === undefined || !requests.delete(requestId)) return;
    const [stillWaiting] = [...requests.values()];
    if (stillWaiting !== undefined) this.set(conversationId, 'awaiting_user', stillWaiting);
    else {
      this.fileRequests.delete(conversationId);
      this.set(conversationId, 'running', null);
    }
  }

  private flag(conversationId: string, key: keyof Pending): void {
    const entry = this.pending.get(conversationId) ?? { plan: false, capability: false };
    entry[key] = true;
    this.pending.set(conversationId, entry);
  }

  private finish(conversationId: string, event: Extract<AgentEvent, { type: 'run_finished' }>): void {
    const pending = this.pending.get(conversationId) ?? { plan: false, capability: false };
    this.pending.delete(conversationId);
    if (event.status === 'done') {
      const reason: AwaitReason | null = pending.plan ? 'plan' : pending.capability ? 'capability' : null;
      if (reason !== null) this.set(conversationId, 'awaiting_user', reason);
      else this.set(conversationId, 'completed', null);
      return;
    }
    if (event.status === 'failed') {
      if (event.error !== undefined && LIMIT_CODES.has(event.error.code)) this.set(conversationId, 'awaiting_user', 'limit');
      else this.set(conversationId, 'failed', null);
      return;
    }
    // cancelada pela pessoa ou interrompida: um pedido de aprovacao que ficou pendente ainda espera ela
    if (pending.plan || pending.capability) this.set(conversationId, 'awaiting_user', pending.plan ? 'plan' : 'capability');
    else this.set(conversationId, 'interrupted', null);
  }

  private set(conversationId: string, to: ActivityState, reason: AwaitReason | null): void {
    const from = this.byConversation.get(conversationId)?.state ?? null;
    this.byConversation.set(conversationId, { conversationId, state: to, reason, updatedAt: this.now().toISOString() });
    for (const listener of this.listeners) listener({ conversationId, from, to, reason });
  }
}
