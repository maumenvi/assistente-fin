import { normalizeText } from '../shared/normalize.text.ts';
import {
  WALLET_CONTENT_DEDUP_BLIND_WINDOW_MS,
  WALLET_CONTENT_DEDUP_WINDOW_MS,
} from './wallet.content.dedup.window.ts';
import { type WalletContentCandidate } from './wallet.content.candidate.ts';
import { type WalletContentWindows } from './wallet.content.windows.ts';
import { type DraftAccount } from './draft.account.ts';

const DEFAULT_WINDOWS: WalletContentWindows = {
  windowMs: WALLET_CONTENT_DEDUP_WINDOW_MS,
  blindWindowMs: WALLET_CONTENT_DEDUP_BLIND_WINDOW_MS,
};

/**
 * Acha o pre-registro pendente da MESMA compra de uma notificacao da carteira (spec 028, research
 * R1). A carteira manda varias notificacoes por compra, com identidade e instante diferentes;
 * aqui so o conteudo conta:
 *
 * - sem valor na notificacao: `null` (nao participa);
 * - o candidato foi criado ha no maximo a janela (medida desde a CRIACAO dele);
 * - mesmo valor, sem conflito de estabelecimento (normalizado) nem de conta; ausente de um lado e
 *   compativel (cartao citado que nao casa com a conta do candidato = conflito);
 * - com estabelecimento ou conta igual (e nao vazios) vale a janela inteira; sem nada comparavel,
 *   so a janela curta;
 * - varios candidatos: o mais antigo.
 */
export function matchWalletContent(
  draft: { readonly amountCents?: number | undefined; readonly description?: string | undefined },
  account: DraftAccount,
  candidates: readonly WalletContentCandidate[],
  now: Date,
  windows: WalletContentWindows = DEFAULT_WINDOWS,
): WalletContentCandidate | null {
  if (draft.amountCents === undefined) return null;
  const description = normalizeText(draft.description);
  const ordered = [...candidates].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  for (const candidate of ordered) {
    const age = now.getTime() - candidate.createdAt.getTime();
    if (age < 0 || age > windows.windowMs) continue;
    if (candidate.amountCents !== draft.amountCents) continue;
    const other = normalizeText(candidate.description);
    if (description !== '' && other !== '' && description !== other) continue;
    if (candidate.accountId !== null && account.hinted && account.id !== candidate.accountId) continue;
    const evidence = (description !== '' && description === other) || (account.id !== null && account.id === candidate.accountId);
    if (!evidence && age > windows.blindWindowMs) continue;
    return candidate;
  }
  return null;
}
