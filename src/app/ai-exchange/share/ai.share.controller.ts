import { type ShareContent } from '../export/build.share.content.use.case.ts';
import { type ShareMode } from '../export/share.mode.ts';
import { rememberSnapshot } from '../remember.snapshot.ts';
import { type Clock } from '../../shared/clock.port.ts';
import { type AiPreferencesPort, type ClipboardWriterPort, type FileSharerPort } from './ai.share.ports.ts';
import { INITIAL_SHARE_STATE, type AiShareState } from './ai.share.state.ts';

export interface AiShareDeps {
  readonly userId: string;
  /** Monta o conteudo (`BuildShareContentUseCase.execute`). */
  readonly build: (input: unknown) => Promise<ShareContent>;
  readonly clipboard: ClipboardWriterPort;
  readonly files: FileSharerPort;
  readonly preferences: AiPreferencesPort;
  readonly clock: Clock;
}

export type ShareAction = 'share' | 'copy';

/**
 * Controlador do fluxo "Compartilhar com IA" (spec 029, FR-011, FR-012, telas 2 a 4): prepara o
 * conteudo, e na execucao COPIA o texto primeiro e so depois abre o compartilhamento do arquivo
 * (assim a reserva existe se o app de IA recusar o arquivo, R8). Lembra a copia entregue (R5) e o
 * instante do envio. Estado observavel (`subscribe`/`getState`) para as telas.
 */
export class AiShareController {
  private readonly deps: AiShareDeps;
  private state: AiShareState = INITIAL_SHARE_STATE;
  private readonly listeners = new Set<() => void>();

  public constructor(deps: AiShareDeps) {
    this.deps = deps;
  }

  public getState = (): AiShareState => this.state;

  public subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Monta o conteudo com as opcoes e o orcamento salvos; `requestText` e o pedido pronto escolhido. */
  public async prepare(mode: ShareMode, requestText: string | null = null): Promise<ShareContent> {
    this.set({ ...INITIAL_SHARE_STATE, busy: true });
    try {
      const prefs = this.deps.preferences.get();
      const content = await this.deps.build({
        userId: this.deps.userId,
        mode,
        requestText,
        budget: prefs.clipboardBudget,
        options: {
          periodDays: prefs.periodDays,
          excludedAccountIds: prefs.excludedAccountIds,
          excludedCategoryIds: prefs.excludedCategoryIds,
          omitDescriptions: prefs.omitDescriptions,
          roundValues: prefs.roundValues,
        },
      });
      this.set({ ...INITIAL_SHARE_STATE, content });
      return content;
    } catch (error) {
      this.set({ ...INITIAL_SHARE_STATE, error });
      throw error;
    }
  }

  /**
   * `copy`: so a copia da parte 1. `share`: copia a parte 1 e abre o compartilhamento com o arquivo
   * de dados (JSON). A copia fica valendo mesmo se o compartilhamento for cancelado ou falhar.
   */
  public async run(action: ShareAction): Promise<void> {
    const content = this.requireContent();
    this.set({ ...this.state, busy: true, error: null });
    try {
      const { sensitive } = this.deps.clipboard.copy(content.parts[0]!.text);
      this.set({ ...this.state, copiedPart: 1, sensitive });
      await this.remember(content);
      if (action === 'share') {
        await this.deps.files.share(content.files[0]!);
        this.set({ ...this.state, sharedFile: content.files[0]!.name });
      }
      this.set({ ...this.state, busy: false });
    } catch (error) {
      this.set({ ...this.state, busy: false, error });
      throw error;
    }
  }

  /** Copia a proxima parte (mais antiga) do historico, para colar no mesmo chat ("Copiar mais"). */
  public copyMore(): number {
    const content = this.requireContent();
    const next = (this.state.copiedPart ?? 1) + 1;
    if (next > content.parts.length) throw new RangeError('nao ha mais partes para copiar');
    const { sensitive } = this.deps.clipboard.copy(content.parts[next - 1]!.text);
    this.set({ ...this.state, copiedPart: next, sensitive });
    return next;
  }

  /** Quantas partes ainda faltam copiar. */
  public remainingParts(): number {
    const content = this.state.content;
    return content === null ? 0 : content.parts.length - (this.state.copiedPart ?? 1);
  }

  /** Abre o compartilhamento com a versao `.txt` do arquivo, para apps que recusam JSON; nao recopia o texto. */
  public async shareAsText(): Promise<void> {
    await this.shareFile(1);
  }

  /** Abre o compartilhamento com o arquivo JSON, sem recopiar o texto ("Enviar como arquivo" da tela 3). */
  public async shareAsJson(): Promise<void> {
    await this.shareFile(0);
  }

  private async shareFile(index: number): Promise<void> {
    const content = this.requireContent();
    const file = content.files[index]!;
    this.set({ ...this.state, busy: true, error: null });
    try {
      await this.deps.files.share(file);
      this.set({ ...this.state, busy: false, sharedFile: file.name });
    } catch (error) {
      this.set({ ...this.state, busy: false, error });
      throw error;
    }
  }

  private async remember(content: ShareContent): Promise<void> {
    const current = this.deps.preferences.get();
    await this.deps.preferences.update({
      ...rememberSnapshot(current, content.snapshot),
      lastShareAt: this.deps.clock.now().toISOString(),
    });
  }

  private requireContent(): ShareContent {
    if (this.state.content === null) throw new Error('nada preparado para compartilhar');
    return this.state.content;
  }

  private set(next: AiShareState): void {
    this.state = next;
    for (const listener of [...this.listeners]) listener();
  }
}
