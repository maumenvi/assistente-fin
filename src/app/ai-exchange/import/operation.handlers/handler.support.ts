import { type AgentOp } from '../../format/agent.op.ts';
import { type JournalImage, type JournalItem } from '../../journal.image.ts';

/** Imagem do diario a partir de itens; `null` quando nao ha nenhum. */
export function imageOf(items: readonly JournalItem[]): JournalImage | null {
  return items.length === 0 ? null : { items };
}

/** `data` da operacao como objeto (vazio se ausente). */
export function dataOf(op: AgentOp): Record<string, unknown> {
  return { ...(op.data ?? {}) };
}

/** Texto curto de uma observacao/descricao para a tela, ou `null` se vazio. */
export function labelOf(text: string | null | undefined): string | null {
  return text === undefined || text === null || text.trim() === '' ? null : text.trim();
}

/** Data como `YYYY-MM-DD` para comparar e mostrar. */
export function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Versao ISO de uma data carimbada, ou `null`. */
export function versionOf(updatedAt: Date | null | undefined): string | null {
  return updatedAt === null || updatedAt === undefined ? null : updatedAt.toISOString();
}
