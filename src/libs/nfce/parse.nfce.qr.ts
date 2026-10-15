import { type CaptureDraft } from '../../domain/capture/capture.draft.ts';
import { decodeNfceAccessKey } from './nfce.access.key.ts';

/**
 * Le o conteudo do QR de uma NFC-e (spec 022, T088; FR-033/FR-034). O parametro `p` traz
 * `chave|versao|ambiente|...`: no QR online so ha chave e hash (valor e data exigem consultar a
 * SEFAZ); no de contingencia vem tambem o dia da emissao e o valor total. Aceita versoes 2 e 3.
 * O link inteiro vai para a observacao; a chave vira `dedupKey`. `null` se nao for NFC-e.
 */
export function parseNfceQr(content: string): CaptureDraft | null {
  const text = content.trim();
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  const p = url.searchParams.get('p') ?? /[?&]p=([^&]+)/.exec(text)?.[1] ?? null;
  if (p === null) return null;
  const parts = decodeURIComponent(p).split('|');
  const key = decodeNfceAccessKey(parts[0] ?? '');
  const version = parts[1];
  if (key === null || key.model !== '65' || (version !== '2' && version !== '3')) return null;

  let amountCents: number | undefined;
  let date: string | undefined;
  const day = parts[3];
  const total = parts[4];
  if (day !== undefined && /^\d{1,2}$/.test(day) && total !== undefined && /^\d+(\.\d{1,2})?$/.test(total)) {
    amountCents = Math.round(Number(total) * 100);
    date = `${key.year}-${String(key.month).padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return {
    origin: 'nfce',
    ...(amountCents !== undefined ? { amountCents } : {}),
    ...(date !== undefined ? { date } : {}),
    notes: text,
    link: text,
    dedupKey: key.key,
    confidence: amountCents !== undefined ? 'high' : 'low',
  };
}
