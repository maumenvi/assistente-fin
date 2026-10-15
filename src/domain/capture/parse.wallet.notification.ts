import { type CaptureDraft } from './capture.draft.ts';
import { type PaymentMethod } from '../simulation/payment.method.ts';
import { type WalletNotification } from './wallet.notification.ts';
import { walletCaptureKey } from './wallet.capture.key.ts';

/** Titulos que nao sao o estabelecimento. */
const GENERIC_TITLE = /^(google (wallet|pay|carteira)|carteira|pix (enviado|realizado|recebido)|pagamento|compra( aprovada)?)$/i;

function amountOf(text: string): number | undefined {
  const match = /r\$\s*(\d{1,3}(?:\.\d{3})*|\d+),(\d{2})/i.exec(text);
  if (!match?.[1] || !match[2]) return undefined;
  return Number(match[1].replace(/\./g, '')) * 100 + Number(match[2]);
}

function methodOf(text: string): PaymentMethod | undefined {
  const plain = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  if (/\bpix\b/.test(plain)) return 'pix';
  if (/\bdebito\b/.test(plain)) return 'debit-card';
  if (/\bcredito\b/.test(plain)) return 'credit-card';
  return undefined;
}

function cardFinalOf(text: string): string | undefined {
  const match = /(?:[•*·]{2,}|final)\s*(\d{4})\b/i.exec(text);
  return match?.[1] ? `final ${match[1]}` : undefined;
}

function merchantOf(title: string, text: string): string | undefined {
  const inText = /\b(?:em|para)\s+(.+?)(?:\s+com\b|\s+no\b|\s+usando\b|[.,]|$)/i.exec(text.replace(/r\$\s*[\d.,]+/i, ''));
  if (inText?.[1] && inText[1].trim().length >= 2) return inText[1].trim().slice(0, 120);
  const cleanTitle = title.trim();
  return cleanTitle !== '' && !GENERIC_TITLE.test(cleanTitle) ? cleanTitle.slice(0, 120) : undefined;
}

/**
 * Notificacao do Google Wallet -> rascunho de pre-registro (spec 022, T131;
 * contracts/capture-parsers.md): valor, estabelecimento/recebedor, final do cartao e pix x
 * compra. Formato desconhecido vira pendencia com o texto original nas observacoes. `dedupKey` =
 * `walletCaptureKey` (spec 027): igual na postagem e nas atualizacoes da mesma compra. A data e a
 * do instante da compra (`when`), ou a da postagem quando o Wallet nao informa.
 */
export function parseWalletNotification(notification: WalletNotification): CaptureDraft {
  const { title, text } = notification;
  const whole = `${title} ${text}`;
  const amountCents = amountOf(whole);
  if (amountCents === undefined) {
    const dedupKey = walletCaptureKey(notification, {});
    return { origin: 'wallet', notes: `${title} — ${text}`.slice(0, 500), dedupKey, confidence: 'low' };
  }
  const paymentMethod = methodOf(whole);
  const accountHint = paymentMethod === 'pix' ? undefined : cardFinalOf(text);
  const description = merchantOf(title, text);
  const dedupKey = walletCaptureKey(notification, { amountCents, description });
  const posted = new Date(notification.when !== undefined && notification.when > 0 ? notification.when : notification.postTime);
  const date = `${String(posted.getFullYear())}-${String(posted.getMonth() + 1).padStart(2, '0')}-${String(posted.getDate()).padStart(2, '0')}`;
  return {
    origin: 'wallet',
    amountCents,
    date,
    ...(description !== undefined ? { description } : {}),
    ...(paymentMethod !== undefined ? { paymentMethod } : {}),
    ...(accountHint !== undefined ? { accountHint } : {}),
    dedupKey,
    confidence: 'high',
  };
}
