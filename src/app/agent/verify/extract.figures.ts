import { parseBrlToCents } from './parse.brl.ts';
import { type Figure } from './figure.ts';

const MONEY_PREFIX = /(-?)R\$\s?(-?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|-?\d+(?:,\d{1,2})?)(?![\d])/g;
const MONEY_REAIS = /(?<![\d.,])(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?)\s+reais(?![\p{L}])/gu;
const PERCENT = /(?<![\d.,])(\d+(?:,\d+)?)\s?%/g;
const DATE_FULL = /(?<![\d/])(\d{1,2})\/(\d{1,2})\/(\d{4})(?![\d/])/g;
const DATE_SHORT = /(?<![\d/])(0[1-9]|[12]\d|3[01])\/(0[1-9]|1[0-2])(?![\d/])/g;
const COUNT_NOUNS =
  'lançamentos?|lancamentos?|transações|transacoes|transação|transacao|parcelas?|contas?|itens|item|cartões|cartoes|cartão|cartao|categorias?|ganhos?|gastos fixos|gasto fixo|compras?|limites?';
const COUNT = new RegExp(`(?<![\\d.,\\p{L}])(\\d{1,3}(?:\\.\\d{3})+|\\d+)\\s+(?:${COUNT_NOUNS})(?![\\p{L}])`, 'gu');

function validDate(day: number, month: number): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= 31;
}

function collect(text: string, pattern: RegExp, build: (m: RegExpExecArray) => Pick<Figure, 'kind' | 'normalized'> | null): Figure[] {
  const out: Figure[] = [];
  for (const m of text.matchAll(pattern)) {
    const built = build(m);
    if (built === null) continue;
    const start = m.index ?? 0;
    out.push({ ...built, raw: m[0], start, end: start + m[0].length });
  }
  return out;
}

/**
 * Extrai de um texto pt-BR as figuras que o agente precisa verificar (spec 031, D10/FR-007):
 * valores em reais ("R$ 1.284,60", "1.284,60 reais"), percentuais ("28%"), datas ("30/09/2026",
 * "30/09") e quantidades com substantivo ("38 lancamentos"). Numeros soltos, versoes ("1.0.18"),
 * mes/ano ("10/2026") e fracoes ("3/4") NAO sao figuras. Em sobreposicao vale a ordem
 * valor > percentual > data > quantidade.
 */
export function extractFigures(text: string): Figure[] {
  const candidates: Figure[] = [
    ...collect(text, MONEY_PREFIX, (m) => {
      const cents = parseBrlToCents(`${m[1] ?? ''}${m[2] ?? ''}`);
      return cents === null ? null : { kind: 'money', normalized: String(cents) };
    }),
    ...collect(text, MONEY_REAIS, (m) => {
      const cents = parseBrlToCents(m[1] as string);
      return cents === null ? null : { kind: 'money', normalized: String(cents) };
    }),
    ...collect(text, PERCENT, (m) => ({ kind: 'percent', normalized: String(Number((m[1] as string).replace(',', '.'))) })),
    ...collect(text, DATE_FULL, (m) => {
      const day = Number(m[1]);
      const month = Number(m[2]);
      if (!validDate(day, month)) return null;
      return { kind: 'date', normalized: `${m[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` };
    }),
    ...collect(text, DATE_SHORT, (m) => ({ kind: 'date', normalized: `${m[2]}-${m[1]}` })),
    ...collect(text, COUNT, (m) => ({ kind: 'count', normalized: String(Number((m[1] as string).replace(/\./g, ''))) })),
  ];
  const accepted: Figure[] = [];
  for (const figure of candidates) {
    const overlaps = accepted.some((a) => figure.start < a.end && a.start < figure.end);
    if (!overlaps) accepted.push(figure);
  }
  return accepted.sort((a, b) => a.start - b.start);
}
