import { repairToolArgs } from './repair.tool.args.ts';
import { type ToolCallDelta } from './tool.call.delta.schema.ts';

/** Chamada de ferramenta ja acumulada e com argumentos interpretados. */
export interface FinalToolCall {
  readonly id: string;
  readonly name: string;
  readonly args: unknown;
  readonly argsError?: string;
  /** `extra_content` devolvido pelo provedor na chamada (ex.: assinatura de pensamento do Gemini). */
  readonly extra?: unknown;
}

interface Entry {
  index: number | null;
  id: string | null;
  name: string;
  argsText: string;
  extra: unknown;
}

/**
 * Acumula os fragmentos de `delta.tool_calls` (spec 031, contracts/openai-compat.wire.md):
 * agrupa por `index` (ou por ordem de chegada quando o provedor omite o indice), junta os
 * `arguments` e, em `finalize`, interpreta o JSON (com reparo tolerante). Id ausente vira
 * `call_<n>`; chamada sem nome e descartada.
 */
export class ToolCallAccumulator {
  private readonly entries: Entry[] = [];
  private readonly byIndex = new Map<number, Entry>();

  public push(deltas: readonly ToolCallDelta[]): void {
    for (const delta of deltas) {
      const entry = this.entryFor(delta);
      if (delta.id) entry.id = entry.id ?? delta.id;
      const name = delta.function?.name;
      if (name && entry.name === '') entry.name = name;
      entry.argsText += delta.function?.arguments ?? '';
      if (delta.extra_content !== undefined && delta.extra_content !== null) entry.extra = delta.extra_content;
    }
  }

  public get isEmpty(): boolean {
    return this.entries.length === 0;
  }

  public finalize(): FinalToolCall[] {
    const ordered = [...this.entries].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const result: FinalToolCall[] = [];
    let position = 0;
    for (const entry of ordered) {
      if (entry.name === '') continue;
      position += 1;
      const id = entry.id ?? `call_${position}`;
      try {
        result.push({ id, name: entry.name, args: repairToolArgs(entry.argsText), ...(entry.extra === undefined ? {} : { extra: entry.extra }) });
      } catch (error) {
        result.push({
          id,
          name: entry.name,
          args: null,
          argsError: `argumentos invalidos: ${error instanceof Error ? error.message : 'JSON ilegivel'}`,
          ...(entry.extra === undefined ? {} : { extra: entry.extra }),
        });
      }
    }
    return result;
  }

  private entryFor(delta: ToolCallDelta): Entry {
    if (delta.index !== undefined && delta.index !== null) {
      const known = this.byIndex.get(delta.index);
      if (known) return known;
      return this.create(delta.index);
    }
    const last = this.entries[this.entries.length - 1];
    const startsNew = last === undefined || (delta.id && last.id && delta.id !== last.id);
    return startsNew ? this.create(null) : (last as Entry);
  }

  private create(index: number | null): Entry {
    const entry: Entry = { index, id: null, name: '', argsText: '', extra: undefined };
    this.entries.push(entry);
    if (index !== null) this.byIndex.set(index, entry);
    return entry;
  }
}
