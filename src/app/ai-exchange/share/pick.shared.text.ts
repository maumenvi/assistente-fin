import { quickMarkerCheck } from '../extract/quick.marker.check.ts';

/** O que o sistema entrega quando outro app compartilha algo com o nosso (forma do `expo-sharing`). */
export interface SharedItem {
  readonly value: string;
  readonly shareType: 'text' | 'url' | 'audio' | 'image' | 'video' | 'file';
  readonly mimeType?: string | undefined;
}

/** Teto do arquivo recebido: um bloco de ate 500 operacoes cabe com muita folga (spec 029, FR-016). */
export const MAX_SHARED_TEXT_CHARS = 5_000_000;

const TEXT_MIME = /^(text\/.+|application\/json)$/;

/**
 * Escolhe o texto do compartilhamento recebido (spec 029, FR-016): texto direto ou arquivo de texto,
 * JSON ou Markdown (lido por `readFile`). Com varios itens, prefere o que tem a marca do formato;
 * sem nenhum, devolve o primeiro texto (a importacao mostra o motivo). `null` se nao ha texto.
 */
export async function pickSharedText(items: readonly SharedItem[], readFile: (uri: string) => Promise<string>): Promise<string | null> {
  const texts: string[] = [];
  for (const item of items) {
    if (item.shareType === 'text' || item.shareType === 'url') {
      texts.push(item.value);
    } else if (item.shareType === 'file' && TEXT_MIME.test(item.mimeType ?? '')) {
      try {
        texts.push(await readFile(item.value));
      } catch {
        // arquivo ilegivel: os demais itens ainda valem
      }
    }
  }
  const usable = texts.filter((text) => text.trim() !== '' && text.length <= MAX_SHARED_TEXT_CHARS);
  return usable.find((text) => quickMarkerCheck(text)) ?? usable[0] ?? null;
}
