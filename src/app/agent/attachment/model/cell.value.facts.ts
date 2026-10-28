import { type Fact } from '../../../../domain/agent/fact.ts';
import { extractFigures } from '../../verify/extract.figures.ts';
import { formatBrl } from '../../verify/format.brl.ts';
import { parseDecimal } from '../extract/parse.decimal.ts';

/** Teto de fatos distintos por anexo: o checkpoint da execucao guarda o livro-razao (spec 040, R5). */
export const MAX_VALUE_FACTS_PER_ATTACHMENT = 1500;

const MONEY_HEADER = /valor|total|saldo|pre[cç]o|amount|value|debito|débito|credito|crédito|receita|despesa|pagamento/i;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/;
const BR_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

/** Colecionador de fatos distintos, com compactacao de `id`/`label` (so a chave de conferencia importa). */
export class ValueFactCollector {
  private readonly seen = new Set<string>();
  private readonly facts: Fact[] = [];
  private readonly prefix: string;
  private readonly cap: number;

  public constructor(prefix: string, cap = MAX_VALUE_FACTS_PER_ATTACHMENT) {
    this.prefix = prefix;
    this.cap = cap;
  }

  public get full(): boolean {
    return this.facts.length >= this.cap;
  }

  public money(cents: number): void {
    this.push(`money:${cents}`, { kind: 'money', value: cents, display: formatBrl(cents) });
  }

  public date(iso: string): void {
    this.push(`date:${iso}`, { kind: 'date', value: iso, display: iso });
  }

  public count(n: number): void {
    this.push(`count:${n}`, { kind: 'count', value: n, display: String(n) });
  }

  public percent(n: number): void {
    this.push(`percent:${n}`, { kind: 'percent', value: n, display: `${n}%` });
  }

  public result(): Fact[] {
    return this.facts;
  }

  private push(key: string, fact: Pick<Fact, 'kind' | 'value' | 'display'>): void {
    if (this.full || this.seen.has(key)) return;
    this.seen.add(key);
    this.facts.push({ id: `${this.prefix}:${this.facts.length}`, label: 'valor do arquivo', sourceCallId: 'attachment', ...fact });
  }
}

/** Registra no coletor tudo que uma celula (ou trecho de texto) diz: dinheiro, data, percentual, quantidade. */
export function collectCellFacts(raw: string, header: string, into: ValueFactCollector): void {
  const text = raw.trim();
  if (text === '' || into.full) return;
  const iso = ISO_DATE.exec(text);
  if (iso !== null) {
    into.date(`${iso[1]}-${iso[2]}-${iso[3]}`);
    return;
  }
  const br = BR_DATE.exec(text);
  if (br !== null) {
    const [day, month] = [Number(br[1]), Number(br[2])];
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) into.date(`${br[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
    return;
  }
  const number = parseDecimal(text);
  if (number !== null) {
    const hasDecimals = /[.,]\d{1,2}$/.test(text.replace(/\s/g, ''));
    if (hasDecimals || MONEY_HEADER.test(header)) into.money(Math.round(number * 100));
    if (Number.isInteger(number) && number >= 0 && number <= 1_000_000) into.count(number);
    return;
  }
  for (const figure of extractFigures(text)) {
    if (figure.kind === 'money') into.money(Number(figure.normalized));
    else if (figure.kind === 'date') into.date(figure.normalized);
    else if (figure.kind === 'percent') into.percent(Number(figure.normalized));
    else into.count(Number(figure.normalized));
  }
}
