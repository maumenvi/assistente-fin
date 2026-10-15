import { type CaptureDraft } from '../../domain/capture/capture.draft.ts';

/** O que a IA recebe para completar uma captura (contracts/capture-parsers.md). */
export interface CaptureAssistantInput {
  readonly draft: CaptureDraft;
  readonly imageJpegBase64?: string | undefined;
  readonly text?: string | undefined;
  /** Nomes das contas/cartoes do usuario, para a IA sugerir a dica certa. */
  readonly accountNames: readonly string[];
}

/**
 * IA opcional que completa um rascunho de captura (spec 022, T127; FR-039..FR-039b). Devolve o
 * JSON CRU da resposta (validado com zod pelo caso de uso) ou `null`; nunca lanca por rede ou
 * limite - quem chama cai no resultado local.
 */
export interface CaptureAssistant {
  complete(input: CaptureAssistantInput): Promise<unknown>;
}
