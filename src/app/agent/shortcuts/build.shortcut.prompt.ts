import { sanitizeText } from '../tools/shared/sanitize.text.ts';
import { formatBrl } from '../verify/format.brl.ts';
import { type ShortcutContext } from './shortcut.context.ts';

const MONTH_NAMES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** "2026-09" -> "setembro de 2026" (mes invalido volta como veio). */
function monthName(month: string): string {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month);
  return match === null ? month : `${MONTH_NAMES[Number(match[2]) - 1]} de ${match[1]}`;
}

function brDate(iso: string): string {
  return /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : iso;
}

/**
 * Texto que um atalho PREENCHE no campo do chat (editavel; nunca e enviado sozinho). A descricao do
 * lancamento e texto livre do usuario e passa por `sanitizeText` (sem `</dados>`, sem controles).
 */
export function buildShortcutPrompt(context: ShortcutContext): string {
  switch (context.kind) {
    case 'explain_transaction':
      return `Explique este gasto: "${sanitizeText(context.description, 80)}" de ${formatBrl(context.amountCents)} em ${brDate(context.date)}. Em que categoria ele entra e como pesa no mês?`;
    case 'summarize_month':
      return `Faça um resumo de ${monthName(context.month)}: receitas, despesas e resultado.`;
    case 'card_invoice':
      return `Como está a fatura do cartão ${sanitizeText(context.accountName, 40)} em ${monthName(context.month)}?`;
  }
}
