import { type CaptureDraft } from './capture.draft.ts';
import { type PaymentMethod } from '../simulation/payment.method.ts';

const MONTHS: Readonly<Record<string, number>> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

/** Rotulos do valor final, do mais para o menos confiavel. */
const TOTAL_LABELS = [/valor\s+aprovado/, /valor\s+total/, /\btotal\b/, /valor\s+pago/, /\bvalor\b/, /importancia\s+de/];

/** Linhas que nunca sao o nome do estabelecimento/recebedor. */
const NOT_NAME = /^(via|comprovante|cnpj|cpf|cielo|stone|rede|getnet|pagseguro|sumup|mercado ?pago|visa|master|elo|amex|hiper|debito|credito|valor|total|data|hora|aut|doc|nsu|pix|recibo|n[o°º]|final|parcela|\*|transacao|instituicao|destino|origem|nome|id\b|sao paulo|rio de janeiro|[a-z ]+ - [a-z]{2}$)/;

function normalize(line: string): string {
  return line.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** "1.234,56" / "45,90" / "R$1.234,56" -> centavos; OCR troca O por 0 nos digitos. */
function moneyIn(line: string): number | undefined {
  const match = /r?\$?\s*(\d{1,3}(?:[.\s]\d{3})*|\d+),(\d{2})\b/.exec(line.replace(/(?<=\d)[oO]|[oO](?=\d)/g, '0'));
  if (!match?.[1] || !match[2]) return undefined;
  return Number(match[1].replace(/[.\s]/g, '')) * 100 + Number(match[2]);
}

function findAmount(lines: readonly string[]): number | undefined {
  for (const label of TOTAL_LABELS) {
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i]!;
      if (!label.test(line)) continue;
      // valor na mesma linha ou na seguinte (comprovante de pix: "Valor" / "R$ 150,00")
      const value = moneyIn(line) ?? (lines[i + 1] !== undefined ? moneyIn(lines[i + 1]!) : undefined);
      if (value !== undefined && value > 0) return value;
    }
  }
  const all = lines.map(moneyIn).filter((v): v is number => v !== undefined && v > 0);
  return all.length === 1 ? all[0] : undefined;
}

function iso(year: number, month: number, day: number): string | undefined {
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const full = year < 100 ? 2000 + year : year;
  return `${String(full)}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function findDate(lines: readonly string[]): string | undefined {
  for (const line of lines) {
    const numeric = /\b(\d{2})\/(\d{2})\/(\d{2,4})\b/.exec(line);
    if (numeric) return iso(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));
  }
  for (const line of lines) {
    const written = /\b(\d{1,2}) de ([a-z]+) de (\d{4})\b/.exec(line);
    const month = written?.[2] !== undefined ? MONTHS[written[2]] : undefined;
    if (written && month !== undefined) return iso(Number(written[3]), month, Number(written[1]));
  }
  return undefined;
}

function findMethod(text: string): PaymentMethod | undefined {
  if (/\bpix\b/.test(text)) return 'pix';
  if (/\bdebito\b/.test(text)) return 'debit-card';
  if (/\bcredito\b|\bparcelad[oa]\b/.test(text)) return 'credit-card';
  if (/\bdinheiro\b|\bespecie\b/.test(text)) return 'cash';
  return undefined;
}

function findInstallments(text: string): number | undefined {
  const explicit = /\bparcelas?:?\s*(\d{1,2})\b|\b(\d{1,2})\s*x\b/.exec(text);
  const n = Number(explicit?.[1] ?? explicit?.[2]);
  if (Number.isInteger(n) && n >= 1 && n <= 48) return n;
  return /\ba vista\b/.test(text) ? 1 : undefined;
}

function findCardFinal(lines: readonly string[]): string | undefined {
  for (const line of lines) {
    const masked = /(?:\*{2,}[\s*]*|final\s+)(\d{4})\b/.exec(line);
    if (masked?.[1]) return `final ${masked[1]}`;
  }
  return undefined;
}

function titleCase(text: string): string {
  return text.toLowerCase().replace(/(^|\s)\p{L}/gu, (c) => c.toUpperCase());
}

function findDescription(raw: readonly string[], lines: readonly string[]): string | undefined {
  // recibo: "referente a ..."
  const joined = raw.join(' ').replace(/\s+/g, ' ');
  const about = /referente (?:a|ao|às|as|aos) (.+?)(?:\.|$)/i.exec(joined);
  if (about?.[1]) return about[1].trim().slice(0, 120);
  // pix: nome depois de "Destino"/"Para"/"Recebedor"
  const dest = lines.findIndex((line) => /^(destino|para|recebedor|favorecido)$/.test(line));
  if (dest >= 0) {
    for (let i = dest + 1; i < Math.min(lines.length, dest + 4); i += 1) {
      if (!NOT_NAME.test(lines[i]!) && /[a-z]{3}/.test(lines[i]!)) return raw[i]!.trim();
    }
  }
  // maquininha: primeira linha com cara de razao social
  for (let i = 0; i < Math.min(lines.length, 6); i += 1) {
    const line = lines[i]!;
    if (NOT_NAME.test(line) || !/[a-z]{3}/.test(line) || /\d{2}\/\d{2}/.test(line)) continue;
    return titleCase(raw[i]!.trim().replace(/\s+(ltda|me|epp|eireli|s\/?a)\.?$/i, ''));
  }
  return undefined;
}

/**
 * Texto do OCR de um comprovante -> rascunho de pre-registro (spec 022, T125;
 * contracts/capture-parsers.md). Entende maquininha (credito/debito/parcelado), comprovante de
 * pix de app de banco e recibo simples. Valor e data achados = `confidence: 'high'`; o resto
 * fica para conferir.
 */
export function parseReceiptText(text: string): CaptureDraft {
  const raw = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  const lines = raw.map(normalize);
  const flat = lines.join('\n');
  const amountCents = findAmount(lines);
  const date = findDate(lines);
  const paymentMethod = findMethod(flat);
  const installments = paymentMethod === 'credit-card' ? findInstallments(flat) : undefined;
  const accountHint = paymentMethod === 'credit-card' || paymentMethod === 'debit-card' ? findCardFinal(lines) : undefined;
  const description = findDescription(raw, lines);
  return {
    origin: 'receipt',
    ...(amountCents !== undefined ? { amountCents } : {}),
    ...(date !== undefined ? { date } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(paymentMethod !== undefined ? { paymentMethod } : {}),
    ...(installments !== undefined ? { installments } : {}),
    ...(accountHint !== undefined ? { accountHint } : {}),
    confidence: amountCents !== undefined && date !== undefined ? 'high' : 'low',
  };
}
