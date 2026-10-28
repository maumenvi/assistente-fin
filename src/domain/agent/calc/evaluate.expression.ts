import { CalcDivisionByZeroError } from '../errors/calc.division.by.zero.error.ts';
import { CalcInvalidExpressionError } from '../errors/calc.invalid.expression.error.ts';
import { type CalcResult } from './calc.result.ts';
import { roundHalfEven } from './round.half.even.ts';

/** Escala interna de ponto fixo (10 casas decimais) para nao perder precisao antes do arredondamento final. */
const SCALE = 10_000_000_000n;
const SCALE_DIGITS = 10;

type Token =
  | { readonly kind: 'num'; readonly scaled: bigint }
  | { readonly kind: 'op'; readonly op: '+' | '-' | '*' | '/' | '(' | ')' | '%' };

/** Converte literal numerico (`1.234,56`, `1234,56` ou `1234.56`) em inteiro escalado por `SCALE`. */
function parseScaledNumber(raw: string): bigint {
  let clean = raw;
  if (clean.includes(',')) {
    if (!/^\d{1,3}(\.\d{3})*(,\d+)?$|^\d+(,\d+)?$/.test(clean)) {
      throw new CalcInvalidExpressionError(`numero invalido: ${raw}`);
    }
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (!/^\d+(\.\d+)?$/.test(clean)) {
    throw new CalcInvalidExpressionError(`numero invalido: ${raw}`);
  }
  const [intPart = '0', fracPart = ''] = clean.split('.');
  const padded = fracPart.slice(0, SCALE_DIGITS).padEnd(SCALE_DIGITS, '0');
  const base = BigInt(intPart) * SCALE + BigInt(padded);
  if (fracPart.length > SCALE_DIGITS && Number(fracPart[SCALE_DIGITS]) >= 5) return base + 1n;
  return base;
}

function tokenize(expression: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < expression.length) {
    const ch = expression[i] as string;
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '(' || ch === ')' || ch === '%') {
      tokens.push({ kind: 'op', op: ch });
      i += 1;
      continue;
    }
    if (/\d/.test(ch)) {
      let j = i;
      while (j < expression.length && /[\d.,]/.test(expression[j] as string)) j += 1;
      tokens.push({ kind: 'num', scaled: parseScaledNumber(expression.slice(i, j)) });
      i = j;
      continue;
    }
    throw new CalcInvalidExpressionError('caractere ou identificador nao permitido na expressao');
  }
  return tokens;
}

/**
 * Avalia uma expressao aritmetica restrita (`+ - * / ( ) %` e numeros em reais) usando parser
 * descendente recursivo em BigInt, sem `eval`, e devolve o resultado em centavos inteiros com
 * arredondamento half-even (spec 037, FR-003, R4).
 */
export function evaluateExpression(expression: string): CalcResult {
  const trimmed = expression.trim();
  if (trimmed === '') throw new CalcInvalidExpressionError('expressao vazia');
  const tokens = tokenize(trimmed);
  if (tokens.length === 0) throw new CalcInvalidExpressionError('expressao vazia');
  let pos = 0;

  const peek = (): Token | undefined => tokens[pos];
  const consume = (): Token => {
    const token = tokens[pos];
    if (token === undefined) throw new CalcInvalidExpressionError('fim inesperado da expressao');
    pos += 1;
    return token;
  };

  function parseAddSub(): bigint {
    let left = parseMulDiv();
    while (true) {
      const next = peek();
      if (next?.kind === 'op' && (next.op === '+' || next.op === '-')) {
        consume();
        const right = parseMulDiv();
        left = next.op === '+' ? left + right : left - right;
      } else {
        break;
      }
    }
    return left;
  }

  function parseMulDiv(): bigint {
    let left = parseUnary();
    while (true) {
      const next = peek();
      if (next?.kind === 'op' && (next.op === '*' || next.op === '/')) {
        consume();
        const right = parseUnary();
        if (next.op === '*') {
          left = roundHalfEven(left * right, SCALE);
        } else {
          if (right === 0n) throw new CalcDivisionByZeroError();
          left = roundHalfEven(left * SCALE, right);
        }
      } else {
        break;
      }
    }
    return left;
  }

  function parseUnary(): bigint {
    const next = peek();
    if (next?.kind === 'op' && (next.op === '+' || next.op === '-')) {
      consume();
      const val = parseUnary();
      return next.op === '-' ? -val : val;
    }
    return parsePostfix();
  }

  function parsePostfix(): bigint {
    let val = parsePrimary();
    while (true) {
      const next = peek();
      if (next?.kind === 'op' && next.op === '%') {
        consume();
        val = roundHalfEven(val, 100n);
      } else {
        break;
      }
    }
    return val;
  }

  function parsePrimary(): bigint {
    const token = consume();
    if (token.kind === 'num') return token.scaled;
    if (token.kind === 'op' && token.op === '(') {
      const inner = parseAddSub();
      const closing = peek();
      if (closing?.kind !== 'op' || closing.op !== ')') {
        throw new CalcInvalidExpressionError('parentese nao fechado');
      }
      consume();
      return inner;
    }
    throw new CalcInvalidExpressionError('termo inesperado na expressao');
  }

  const scaledResult = parseAddSub();
  if (pos < tokens.length) throw new CalcInvalidExpressionError('tokens extras no fim da expressao');
  const cents = Number(roundHalfEven(scaledResult * 100n, SCALE));
  return { kind: 'money', value: cents, formula: trimmed, sources: [] };
}

