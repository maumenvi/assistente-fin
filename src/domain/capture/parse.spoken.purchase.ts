import { type CaptureDraft } from './capture.draft.ts';
import { type PaymentMethod } from '../simulation/payment.method.ts';
import { parseNumberWords, parseSpokenAmount } from './parse.number.words.ts';

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/r\$\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const METHOD_PATTERNS: readonly [RegExp, PaymentMethod][] = [
  [/\bpix\b/, 'pix'],
  [/\bdebito\b/, 'debit-card'],
  [/\b(credito|parcelad[oa]|cartao de credito)\b/, 'credit-card'],
  [/\b(dinheiro|especie|em maos)\b/, 'cash'],
];

/** Palavras que nunca sao nome de conta/cartao. */
const NOT_ACCOUNT = new Set([
  'pix', 'debito', 'credito', 'cartao', 'dinheiro', 'mercado', 'supermercado', 'total', 'valor',
  'padaria', 'feira', 'farmacia', 'acougue', 'loja', 'shopping', 'posto', 'restaurante',
]);

function findAmount(text: string): number | null {
  const decimal = /(\d+(?:\.\d{3})*),(\d{1,2})\b|(\d+)\.(\d{2})\b/.exec(text);
  if (decimal) {
    const [, intComma, decComma, intDot, decDot] = decimal;
    const integer = (intComma ?? intDot ?? '0').replace(/\./g, '');
    const cents = (decComma ?? decDot ?? '0').padEnd(2, '0');
    return Number(integer) * 100 + Number(cents);
  }
  const withReais = /(\d+)\s*(?:reais|real|conto|contos)(?:\s*e\s*(\d{1,2})\s*(?:centavos)?)?/.exec(text);
  if (withReais?.[1]) return Number(withReais[1]) * 100 + Number(withReais[2] ?? 0);
  const plain = /(?:gastei|paguei|ficou em|deu|valor de|custou|foi|por)\s+(\d+)\b(?!\s*x)/.exec(text);
  if (plain?.[1]) return Number(plain[1]) * 100;
  const words = /((?:(?:cem|cento|duzent|trezent|quatrocent|quinhent|seiscent|setecent|oitocent|novecent|mil|vinte|trinta|quarenta|cinquenta|sessenta|setenta|oitenta|noventa|dez|onze|doze|treze|quatorze|catorze|quinze|dezesseis|dezessete|dezoito|dezenove|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove)\w*|e|reais|real|centavos)(?:\s+|$))+/.exec(
    text.replace(/\b(parcelad[oa] em|em)\s+\w+\s+vezes\b/g, ' '),
  );
  if (words?.[0] && parseNumberWords(words[0]).length > 0) return parseSpokenAmount(words[0]);
  return null;
}

function findInstallments(text: string): number | undefined {
  const x = /\b(\d{1,2})\s*x\b/.exec(text);
  if (x?.[1]) return Number(x[1]);
  const times = /\bem\s+(\d{1,2}|\w+)\s+vezes\b/.exec(text);
  if (times?.[1]) {
    const n = /^\d+$/.test(times[1]) ? Number(times[1]) : parseNumberWords(times[1])[0];
    if (n !== undefined && n >= 1) return n;
  }
  if (/\b(a vista|avista)\b/.test(text)) return 1;
  return undefined;
}

function findAccountHint(text: string): string | undefined {
  const matches = [...text.matchAll(/\b(?:no|na|pelo|pela|do|da)\s+(?:cartao\s+(?:do|da)?\s*)?([a-z][a-z0-9]*)/g)];
  for (let i = matches.length - 1; i >= 0; i -= 1) {
    const candidate = matches[i]?.[1];
    if (candidate !== undefined && !NOT_ACCOUNT.has(candidate) && !/^\d/.test(candidate)) return candidate;
  }
  return undefined;
}

function cleanDescription(raw: string): string | undefined {
  const text = raw
    .replace(/\b(de|por|com)\s*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length >= 2 ? text : undefined;
}

function findDescription(text: string): string | undefined {
  const clause = text.split(/[,;.]/)[0] ?? text;
  const patterns = [
    /\b(?:fiz (?:uma )?compra|fiz compras|comprei|compra)\s+(?:no|na|em|nos|nas)\s+(.+)/,
    /\b(?:comprei|paguei|pagamento d[eoa]s?)\s+(?:um|uma|o|a|os|as)?\s*(.+?)(?:\s+(?:em\s+\w+\s+vezes|no|na|pelo|pela|parcelad[oa])\b.*)?$/,
    /\b(?:gastei|foram)\s+.*?\s+(?:no|na|em|com)\s+(.+)/,
    /\b(?:almoco|jantar|lanche|cafe|uber|gasolina|farmacia|padaria|mercado|supermercado|feira|ifood)\b.*/,
  ];
  for (const pattern of patterns) {
    const match = pattern.exec(clause);
    if (match) {
      const value = (match[1] ?? match[0])
        .replace(/\b(\d+([.,]\d+)?|reais|real|no pix|no debito|no credito|pix|debito|credito)\b.*$/, '')
        .trim();
      const cleaned = cleanDescription(value);
      if (cleaned !== undefined) return cleaned;
    }
  }
  return undefined;
}

/**
 * Transforma uma frase falada em rascunho de pre-registro (spec 022, T098; FR-038). Exemplos:
 * "Fiz compra no supermercado, gastei 145.30 reais, credito parcelado 2x no iti" e "Comprei
 * queijo, ficou em 65 reais no pix no itau". O que nao for reconhecido fica em branco; sem valor
 * ou sem forma de pagamento, a confianca e baixa ("conferir").
 */
export function parseSpokenPurchase(transcript: string): CaptureDraft {
  const text = normalize(transcript);
  const amountCents = findAmount(text);
  const installments = findInstallments(text);
  // "em 3 vezes" / "3x" sem dizer a forma: parcelamento e sempre no credito
  const paymentMethod =
    METHOD_PATTERNS.find(([pattern]) => pattern.test(text))?.[1] ?? (installments !== undefined && installments > 1 ? 'credit-card' : undefined);
  const accountHint = findAccountHint(text);
  const description = findDescription(text);
  return {
    origin: 'voice',
    ...(amountCents !== null ? { amountCents } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(paymentMethod !== undefined ? { paymentMethod } : {}),
    ...(installments !== undefined && paymentMethod === 'credit-card' ? { installments } : {}),
    ...(accountHint !== undefined ? { accountHint } : {}),
    notes: `Registrado por voz: “${transcript.trim()}”`,
    confidence: amountCents !== null && paymentMethod !== undefined ? 'high' : 'low',
  };
}
