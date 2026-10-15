import { type ApplyAgentImportUseCase } from './apply.agent.import.use.case.ts';
import { type ApplyDestructiveUseCase } from './apply.destructive.use.case.ts';
import { type GetAiBatchUseCase } from './get.ai.batch.use.case.ts';
import { type PlanAgentImportUseCase } from './plan.agent.import.use.case.ts';
import { type UndoAgentBatchUseCase } from './undo.agent.batch.use.case.ts';
import { type AiPreferencesPort } from '../share/ai.share.ports.ts';
import { AiBlockInvalidError } from '../errors/ai.block.invalid.error.ts';
import { AiBlockNotFoundError } from '../errors/ai.block.not.found.error.ts';
import { AiBlockVersionError } from '../errors/ai.block.version.error.ts';
import { type AiBatchSource } from '../ai.batch.source.ts';
import { isBatchRemembered, rememberBatchId } from '../remember.batch.id.ts';
import { IDLE_IMPORT_STATE, type AiImportState } from './ai.import.state.ts';

/** Casos de uso que a importacao usa (o `AiExchange` da composicao os satisfaz). */
export interface AiImportUseCases {
  readonly planAgentImport: Pick<PlanAgentImportUseCase, 'execute'>;
  readonly applyAgentImport: Pick<ApplyAgentImportUseCase, 'execute'>;
  readonly applyDestructive: Pick<ApplyDestructiveUseCase, 'execute'>;
  readonly undoAgentBatch: Pick<UndoAgentBatchUseCase, 'execute'>;
  readonly getAiBatch: Pick<GetAiBatchUseCase, 'execute'>;
}

export interface AiImportDeps {
  readonly userId: string;
  readonly useCases: AiImportUseCases;
  readonly preferences: AiPreferencesPort;
  /** Avisa que dados mudaram (telas recarregam e a sincronizacao e disparada). */
  readonly onDataChanged: () => void;
}

/** O que a oferta automatica (volta ao primeiro plano) encontrou na area de transferencia. */
export type OfferOutcome = 'offered' | 'invalid' | 'none';

/**
 * Controlador da importacao do bloco do agente (spec 029, FR-004, FR-006, FR-016, telas 5 a 8):
 * planeja (sem escrever), aplica com um toque, confirma as destrutivas e desfaz o lote. A oferta
 * automatica ignora silenciosamente o que nao e bloco, o bloco de exemplo e lotes ja importados ou
 * dispensados; "Colar da IA" (manual) mostra o motivo.
 */
export class AiImportController {
  private readonly deps: AiImportDeps;
  private state: AiImportState = IDLE_IMPORT_STATE;
  private readonly listeners = new Set<() => void>();

  public constructor(deps: AiImportDeps) {
    this.deps = deps;
  }

  public getState = (): AiImportState => this.state;

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /**
   * Oferta automatica ao voltar ao primeiro plano. So muda o estado se houver bloco novo a mostrar.
   * Bloco malformado vira a tela de erro (`invalid`), porque quase sempre e um bloco de agente cortado.
   */
  public async offerFromClipboard(text: string | null): Promise<OfferOutcome> {
    if (text === null) return 'none';
    return this.load(text, 'clipboard', { silent: true });
  }

  /** "Colar da IA" e receber compartilhamento: mostra erro tambem quando nao ha bloco. */
  public async importFromText(text: string, source: AiBatchSource): Promise<OfferOutcome> {
    return this.load(text, source, { silent: false });
  }

  /** Aplica as operacoes seguras (1 toque). */
  public async apply(): Promise<void> {
    if (this.state.phase !== 'planned') throw new Error('nada planejado para importar');
    const { text, source, plan } = this.state;
    this.set({ phase: 'applying' });
    try {
      const result = await this.deps.useCases.applyAgentImport.execute({ userId: this.deps.userId, text, source }, this.deps.preferences.get());
      await this.remember(plan.batchId);
      this.deps.onDataChanged();
      this.set({ phase: 'applied', result });
    } catch (error) {
      if (error instanceof AiBlockInvalidError) this.set({ phase: 'invalid', issues: error.issues });
      else this.set({ phase: 'failed', error });
      throw error;
    }
  }

  /** "Dispensar": o app nao oferece este bloco de novo. */
  public async dismiss(): Promise<void> {
    if (this.state.phase === 'planned') await this.remember(this.state.plan.batchId);
    this.set(IDLE_IMPORT_STATE);
  }

  /** Confirma na tela propria as destrutivas escolhidas (`seq` das operacoes) e recusa as demais. */
  public async confirmDestructive(batchId: string, confirmedSeqs: readonly number[]): Promise<void> {
    const result = await this.deps.useCases.applyDestructive.execute({ userId: this.deps.userId, batchId, confirmedSeqs: [...confirmedSeqs] });
    this.deps.onDataChanged();
    this.set({ phase: 'applied', result });
  }

  /** Desfaz o lote inteiro; `force` desfaz tambem o que mudou depois dele. */
  public async undo(batchId: string, force = false): Promise<readonly string[]> {
    const undone = await this.deps.useCases.undoAgentBatch.execute({ userId: this.deps.userId, batchId, force });
    this.deps.onDataChanged();
    return undone.conflicts;
  }

  /** Volta a ocioso (fecha as telas de resultado). */
  public reset(): void {
    this.set(IDLE_IMPORT_STATE);
  }

  private async load(text: string, source: AiBatchSource, options: { silent: boolean }): Promise<OfferOutcome> {
    try {
      const plan = await this.deps.useCases.planAgentImport.execute({ userId: this.deps.userId, text }, this.deps.preferences.get());
      if (plan.status === 'already_applied') {
        if (!options.silent) this.set({ phase: 'failed', error: new Error('este lote ja foi importado') });
        return options.silent ? 'none' : 'invalid';
      }
      if (options.silent && isBatchRemembered(this.deps.preferences.get(), plan.batchId)) return 'none';
      if (plan.status === 'invalid') {
        this.set({ phase: 'invalid', issues: plan.errors });
        return 'invalid';
      }
      this.set({ phase: 'planned', plan, text, source });
      return 'offered';
    } catch (error) {
      if (error instanceof AiBlockNotFoundError) {
        if (!options.silent) this.set({ phase: 'failed', error });
        return options.silent ? 'none' : 'invalid';
      }
      if (error instanceof AiBlockInvalidError) {
        this.set({ phase: 'invalid', issues: error.issues });
        return 'invalid';
      }
      if (error instanceof AiBlockVersionError) {
        this.set({ phase: 'invalid', issues: [{ opIndex: -1, path: '', message: `versao do formato nao suportada (${error.found}); peca ao agente para usar o formato mais recente` }] });
        return 'invalid';
      }
      throw error;
    }
  }

  private async remember(batchId: string): Promise<void> {
    await this.deps.preferences.update(rememberBatchId(this.deps.preferences.get(), batchId));
  }

  private set(next: AiImportState): void {
    this.state = next;
    for (const listener of [...this.listeners]) listener();
  }
}
