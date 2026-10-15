import { type OfferOutcome } from './import/ai.import.controller.ts';

export interface RefreshDeps {
  /** Dispara a sincronizacao com o desktop (nao faz nada fora do modo conjunto). */
  readonly syncNow: () => void;
  /** Avisa que dados mudaram para as telas recarregarem. */
  readonly bump: () => void;
  /** Texto da area de transferencia SE tiver a marca do formato (so em primeiro plano e desbloqueado). */
  readonly readClipboardCandidate: () => string | null;
  readonly offer: (text: string | null) => Promise<OfferOutcome>;
}

export interface RefreshResult {
  readonly outcome: OfferOutcome;
  /** O que mostrar ao usuario quando nao ha nada para importar. */
  readonly message: string | null;
}

/**
 * Acao do botao "Atualizar" do Inicio (spec 029, FR-019, US4): nao espera o ciclo natural. Dispara
 * a sincronizacao, recarrega as telas e oferece importar um bloco valido da area de transferencia;
 * sem bloco, diz que esta tudo em dia, sem erro.
 */
export async function runRefresh(deps: RefreshDeps): Promise<RefreshResult> {
  deps.syncNow();
  deps.bump();
  const outcome = await deps.offer(deps.readClipboardCandidate());
  return { outcome, message: outcome === 'none' ? 'Tudo em dia.' : null };
}
