import { type Fact } from '../../../../domain/agent/fact.ts';
import { type QuerySummary } from '../../../../domain/agent/query.summary.ts';
import { type ToolResult } from '../../ports/tool/tool.result.ts';

/** Entrada de `buildToolResult`. */
export interface BuildToolResultInput {
  readonly tool: string;
  /** Texto do resultado para o modelo (sem o envelope `<dados>`). */
  readonly body: string;
  readonly facts: readonly Fact[];
  readonly summary: QuerySummary;
  /** Teto de caracteres do texto inteiro (envelope incluso); padrao 6.000. */
  readonly maxChars?: number;
}

const DEFAULT_MAX_CHARS = 6000;
const TRUNCATION_NOTE = '\n[resultado cortado: use filtros mais estreitos para ver o restante]';

/**
 * Monta o resultado de uma ferramenta de consulta (spec 031, contracts/tool.port.md): o texto vai
 * dentro de `<dados origem="...">...</dados>` (o modelo trata como informacao, nunca como
 * instrucao) e e cortado no teto, marcando `summary.truncated`.
 */
export function buildToolResult(input: BuildToolResultInput): ToolResult {
  const maxChars = input.maxChars ?? DEFAULT_MAX_CHARS;
  const open = `<dados origem="${input.tool}">\n`;
  const close = '\n</dados>';
  const room = maxChars - open.length - close.length;
  let body = input.body;
  let cut = false;
  if (body.length > room) {
    body = `${body.slice(0, Math.max(0, room - TRUNCATION_NOTE.length))}${TRUNCATION_NOTE}`;
    cut = true;
  }
  return {
    ok: true,
    contentForModel: `${open}${body}${close}`,
    facts: input.facts,
    summary: cut ? { ...input.summary, truncated: true } : input.summary,
  };
}
