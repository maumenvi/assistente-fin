import { type ShareContent } from '../export/build.share.content.use.case.ts';

/** O que as telas de compartilhar leem do controlador (spec 029, telas 2, 3 e 4). */
export interface AiShareState {
  /** Conteudo preparado e mostrado no aviso (tela 4) e no resultado (tela 3). */
  readonly content: ShareContent | null;
  /** Parte do texto que esta na area de transferencia agora (1-based), ou `null`. */
  readonly copiedPart: number | null;
  /** O texto copiado foi marcado como sensivel (Android 13+)? */
  readonly sensitive: boolean | null;
  /** Um arquivo foi enviado ao compartilhamento do sistema. */
  readonly sharedFile: string | null;
  readonly busy: boolean;
  readonly error: unknown;
}

export const INITIAL_SHARE_STATE: AiShareState = { content: null, copiedPart: null, sensitive: null, sharedFile: null, busy: false, error: null };
