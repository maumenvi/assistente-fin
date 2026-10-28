import { type KeyInfo } from './key.info.ts';

/** O que o teste descobriu pelo caminho (mostrado na tela e usado nos textos). */
export interface DetectedInfo {
  readonly contextTokens: number | null;
  readonly installedModels: readonly string[];
  readonly keyInfo: KeyInfo | null;
}
