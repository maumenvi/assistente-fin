import { type Fact } from '../../../../domain/agent/fact.ts';

/** Limites dos argumentos enviados a uma capacidade externa. */
export const EGRESS_MAX_BYTES = 4096;
export const EGRESS_MAX_STRING = 1000;

export type EgressVerdict = { readonly ok: true } | { readonly ok: false; readonly blocked: 'egress' | 'size'; readonly reason: string };

export interface EgressContext {
  /** Texto do usuario na rodada (o que ele escreveu). */
  readonly userText: string;
  /** Fatos consultados nesta rodada (ledger). */
  readonly facts: readonly Fact[];
  readonly now: Date;
  /** Ids de registros do app (contas, categorias...) que nao podem sair sem o usuario citar. */
  readonly protectedIds?: ReadonlySet<string> | undefined;
}

const NUMBER = /\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?/g;
const ISO_DATE = /\b(\d{4})-(\d{2})-(\d{2})\b/g;

function parseNumber(token: string): number {
  if (token.includes(',') && token.includes('.')) return Number(token.replace(/\./g, '').replace(',', '.'));
  if (token.includes(',')) return Number(token.replace(',', '.'));
  if (/^\d{1,3}(\.\d{3})+$/.test(token)) return Number(token.replace(/\./g, ''));
  return Number(token);
}

function numbersOf(text: string): number[] {
  return (text.match(NUMBER) ?? []).map(parseNumber).filter((n) => Number.isFinite(n));
}

function walk(value: unknown, out: { strings: string[]; numbers: number[] }): void {
  if (typeof value === 'string') out.strings.push(value);
  else if (typeof value === 'number') out.numbers.push(value);
  else if (Array.isArray(value)) for (const v of value) walk(v, out);
  else if (value !== null && typeof value === 'object') for (const v of Object.values(value)) walk(v, out);
}

function sameNumber(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9;
}

function dateDeclared(iso: string, ctx: EgressContext): boolean {
  const [y, m, d] = iso.split('-') as [string, string, string];
  const text = ctx.userText;
  if (text.includes(iso) || text.includes(`${d}/${m}/${y}`) || new RegExp(`(^|[^\\d/])${d}/${m}([^\\d/]|$)`).test(text)) return true;
  if (ctx.facts.some((f) => f.kind === 'date' && String(f.value).slice(0, 10) === iso)) return true;
  const day = Date.parse(`${iso}T12:00:00.000Z`);
  const today = Date.UTC(ctx.now.getUTCFullYear(), ctx.now.getUTCMonth(), ctx.now.getUTCDate(), 12);
  return Math.abs(day - today) <= 86_400_000 && /\b(hoje|ontem|amanha)\b/i.test(text.normalize('NFD').replace(/[̀-ͯ]/g, ''));
}

/**
 * Barreira de saida (spec 034, FR-010, contracts/safety.md): antes de chamar uma capacidade externa, todo
 * valor relevante, data completa e id de registro do app nos argumentos precisa estar no texto do usuario
 * ou nos fatos consultados nesta rodada. Textos longos demais e argumentos grandes tambem sao barrados.
 */
export function checkEgress(args: unknown, ctx: EgressContext): EgressVerdict {
  const json = JSON.stringify(args ?? {});
  if (json.length > EGRESS_MAX_BYTES) return { ok: false, blocked: 'size', reason: 'argumentos grandes demais para enviar a uma capacidade externa' };
  const found = { strings: [] as string[], numbers: [] as number[] };
  walk(args, found);
  if (found.strings.some((s) => s.length > EGRESS_MAX_STRING)) return { ok: false, blocked: 'size', reason: 'texto longo demais para enviar a uma capacidade externa' };

  const declared = [...numbersOf(ctx.userText), ...ctx.facts.flatMap((f) => (f.kind === 'money' && typeof f.value === 'number' ? [f.value / 100, f.value] : typeof f.value === 'number' ? [f.value] : numbersOf(f.display)))];
  const argNumbers = [...found.numbers, ...found.strings.flatMap((s) => numbersOf(s.replace(ISO_DATE, " ")))];
  for (const n of argNumbers) {
    const relevant = !Number.isInteger(n) || Math.abs(n) >= 100;
    if (relevant && !declared.some((d) => sameNumber(d, n))) return { ok: false, blocked: 'egress', reason: `dado financeiro nao declarado: o valor ${String(n)} nao veio do pedido nem de uma consulta` };
  }
  for (const s of found.strings) {
    for (const m of s.matchAll(ISO_DATE)) if (!dateDeclared(m[0], ctx)) return { ok: false, blocked: 'egress', reason: `dado nao declarado: a data ${m[0]} nao veio do pedido nem de uma consulta` };
    if (ctx.protectedIds?.has(s) === true && !ctx.userText.includes(s)) return { ok: false, blocked: 'egress', reason: 'identificador interno do app nao pode ser enviado a uma capacidade externa' };
  }
  return { ok: true };
}
