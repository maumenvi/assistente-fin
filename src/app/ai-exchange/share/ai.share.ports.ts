import { type AiExchangePreferences } from '../ai.exchange.preferences.ts';
import { type ShareFile } from '../export/share.file.ts';

/** Escreve na area de transferencia e diz se o texto foi marcado como sensivel (spec 029, FR-012). */
export interface ClipboardWriterPort {
  copy(text: string): { readonly sensitive: boolean };
}

/** Entrega um arquivo ao compartilhamento do sistema e limpa o temporario (spec 029, FR-011). */
export interface FileSharerPort {
  share(file: ShareFile): Promise<void>;
}

/** Leitura e gravacao das preferencias da troca com IA (do aparelho). */
export interface AiPreferencesPort {
  get(): AiExchangePreferences;
  update(patch: Partial<AiExchangePreferences>): Promise<AiExchangePreferences>;
}
