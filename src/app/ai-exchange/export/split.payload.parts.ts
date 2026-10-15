import { type AgentPayload, type AgentCell } from '../format/agent.payload.ts';
import { composeFirstPartHeader, composeNextPartHeader } from './compose.share.text.ts';

/** Parte do texto copiado (spec 029, FR-011): `text` e o que vai para a area de transferencia. */
export interface PayloadPart {
  readonly index: number;
  readonly count: number;
  readonly text: string;
  /** Quantas linhas de transacao ha nesta parte. */
  readonly rowCount: number;
  /** Conteudo desta parte, para montar o arquivo do recorte. */
  readonly payload: AgentPayload;
}

export interface CoveredRange {
  readonly from: string | null;
  readonly to: string | null;
  readonly count: number;
}

export interface SplitResult {
  readonly parts: readonly PayloadPart[];
  /** Periodo e quantidade de transacoes da PARTE 1 (a copia imediata). */
  readonly covered: CoveredRange;
  /** Quantas partes ainda faltam depois da parte 1. */
  readonly remaining: number;
  readonly totalRows: number;
}

/** Folga de seguranca sobre o orcamento (spec 029, FR-011: "com margem"). */
const BUDGET_MARGIN = 0.9;

/** Espaco reservado para o `part` com contagem de ate 4 digitos, ja que ela so e conhecida no fim. */
const PART_FIELD_SLACK = 40;

function stringify(payload: AgentPayload): string {
  return JSON.stringify(payload);
}

function withRows(payload: AgentPayload, rows: readonly (readonly AgentCell[])[], part: { index: number; count: number } | null, withCatalog: boolean): AgentPayload {
  const { catalog, part: _part, ...rest } = payload;
  return {
    ...rest,
    ...(part === null ? {} : { part }),
    ...(withCatalog && catalog !== undefined ? { catalog } : {}),
    transactions: { cols: payload.transactions.cols, rows },
  };
}

/**
 * Parte o conteudo em textos numerados que cabem no orcamento da area de transferencia (spec 029,
 * FR-011, R6). Transacoes mais recentes primeiro; a parte 1 leva pedido, instrucoes e cadastros; as
 * demais so transacoes mais antigas, todas com o mesmo `snapshot.id`. Nunca corta uma linha no meio.
 * O orcamento e em caracteres (a area de transferencia guarda UTF-16, ~2 bytes cada).
 */
export function splitPayloadParts(payload: AgentPayload, requestText: string | null, budget: number): SplitResult {
  const effective = Math.floor(budget * BUDGET_MARGIN);
  const rows = payload.transactions.rows;
  const rowLength = rows.map((row) => JSON.stringify(row).length + 1);

  const firstHeader = composeFirstPartHeader(requestText);
  const firstBase = firstHeader.length + 2 + stringify(withRows(payload, [], { index: 1, count: 1 }, true)).length + PART_FIELD_SLACK;

  const chunks: { start: number; end: number }[] = [];
  let cursor = 0;
  let used = firstBase;
  while (cursor < rows.length && used + rowLength[cursor]! <= effective) {
    used += rowLength[cursor]!;
    cursor += 1;
  }
  chunks.push({ start: 0, end: cursor });

  const nextBase = composeNextPartHeader(99, 99, payload.snapshot.id).length + 2 + stringify(withRows(payload, [], { index: 99, count: 99 }, false)).length + PART_FIELD_SLACK;
  while (cursor < rows.length) {
    const start = cursor;
    let size = nextBase;
    // uma linha sempre entra, mesmo que sozinha passe do orcamento (evita laco infinito)
    do {
      size += rowLength[cursor]!;
      cursor += 1;
    } while (cursor < rows.length && size + rowLength[cursor]! <= effective);
    chunks.push({ start, end: cursor });
  }

  const count = chunks.length;
  const parts: PayloadPart[] = chunks.map((chunk, position) => {
    const index = position + 1;
    const partRows = rows.slice(chunk.start, chunk.end);
    const part = count === 1 ? null : { index, count };
    const partPayload = withRows(payload, partRows, part, index === 1);
    const header = index === 1 ? firstHeader : composeNextPartHeader(index, count, payload.snapshot.id);
    return { index, count, text: `${header}\n${stringify(partPayload)}`, rowCount: partRows.length, payload: partPayload };
  });

  const first = parts[0]!;
  const dateIndex = payload.transactions.cols.indexOf('date');
  const firstRows = first.payload.transactions.rows;
  const newest = firstRows.length > 0 ? String(firstRows[0]![dateIndex]) : null;
  const oldest = firstRows.length > 0 ? String(firstRows[firstRows.length - 1]![dateIndex]) : null;
  return {
    parts,
    covered: { from: oldest, to: newest, count: first.rowCount },
    remaining: count - 1,
    totalRows: rows.length,
  };
}
