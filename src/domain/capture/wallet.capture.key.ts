import { hashText } from './hash.text.ts';
import { type WalletNotification } from './wallet.notification.ts';

function normalize(text: string | undefined): string {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Chave de captura de uma notificacao do Google Wallet (spec 027, research R1): a mesma para a
 * postagem e as atualizacoes da mesma compra, diferente entre compras.
 * - com `notificationKey` e `when` > 0: pacote + chave da notificacao + instante da compra;
 * - com `notificationKey` sem `when`: pacote + chave + valor + estabelecimento normalizado;
 * - sem `notificationKey` (nativo antigo): a chave legada com `postTime` + texto.
 */
export function walletCaptureKey(
  notification: WalletNotification,
  parsed: { readonly amountCents?: number | undefined; readonly description?: string | undefined },
): string {
  const { packageName, notificationKey, when, title, text, postTime } = notification;
  if (notificationKey !== undefined && notificationKey !== '') {
    if (when !== undefined && when > 0) return `wallet:${hashText(`${packageName}|${notificationKey}|${String(when)}`)}`;
    return `wallet:${hashText(`${packageName}|${notificationKey}|${String(parsed.amountCents ?? '')}|${normalize(parsed.description)}`)}`;
  }
  return `wallet:${hashText(`${packageName}|${String(postTime)}|${title}|${text}`)}`;
}
