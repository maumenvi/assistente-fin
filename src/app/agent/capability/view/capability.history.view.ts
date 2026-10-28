import { type CapabilityUse } from '../../../../domain/capability/capability.use.ts';
import { sanitizeText } from '../../tools/shared/sanitize.text.ts';

export const EMPTY_HISTORY_TEXT = 'Esta capacidade ainda não foi usada.';
export const ARGS_PREVIEW_CHARS = 120;

export type UseTone = 'ok' | 'blocked' | 'error';

export interface CapabilityUseRow {
  readonly id: string;
  readonly tool: string;
  readonly whenText: string;
  readonly durationText: string;
  /** "Enviado: ..." (argumentos truncados) ou null quando nao ha nada a mostrar. */
  readonly sentText: string | null;
  readonly resultText: string;
  readonly tone: UseTone;
  /** Alerta de texto que dava ordens ao assistente (tratado como dado). */
  readonly injectionAlert: string | null;
}

const two = (n: number): string => String(n).padStart(2, '0');

function whenOf(iso: string): string {
  const d = new Date(iso);
  return `${two(d.getDate())}/${two(d.getMonth() + 1)} ${two(d.getHours())}:${two(d.getMinutes())}`;
}

/** "de USD, para BRL, valor 120" a partir do JSON dos argumentos (truncado; nunca quebra com JSON invalido). */
export function previewArgs(argsJson: string): string | null {
  try {
    const value = JSON.parse(argsJson) as unknown;
    if (value === null || typeof value !== 'object' || Object.keys(value).length === 0) return null;
    const text = Object.entries(value as Record<string, unknown>).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join(', ');
    return sanitizeText(text, ARGS_PREVIEW_CHARS);
  } catch {
    return sanitizeText(argsJson, ARGS_PREVIEW_CHARS) || null;
  }
}

/** Linhas do historico de uso (tela Capacidades e passo da execucao): o que foi enviado e o que voltou. */
export function buildUseRows(uses: readonly CapabilityUse[]): CapabilityUseRow[] {
  return uses.map((u) => ({
    id: u.id,
    tool: u.tool,
    whenText: whenOf(u.at),
    durationText: u.blocked !== null ? 'bloqueada' : `${String(u.durationMs)} ms`,
    sentText: u.blocked !== null ? null : previewArgs(u.argsJson),
    resultText: u.blocked !== null ? sanitizeText(u.resultSummary, 200) : u.ok ? sanitizeText(u.resultSummary, 200) : `Falhou: ${sanitizeText(u.resultSummary, 160)}`,
    tone: u.blocked !== null ? 'blocked' : u.ok ? 'ok' : 'error',
    injectionAlert: u.suspectedInjection ? 'Atenção: o resultado trazia instruções (“ignore as regras…”). O assistente as tratou como texto e não obedeceu.' : null,
  }));
}

/** Do `args` de `call_capability_tool` (`{ name, arguments }`): o nome qualificado e o que foi enviado, truncado. */
export function externalCallLines(args: unknown): { readonly qualified: string | null; readonly sent: string | null } {
  if (args === null || typeof args !== 'object') return { qualified: null, sent: null };
  const { name, arguments: inner } = args as { name?: unknown; arguments?: unknown };
  return { qualified: typeof name === 'string' ? sanitizeText(name, 80) : null, sent: previewArgs(JSON.stringify(inner ?? {})) };
}
