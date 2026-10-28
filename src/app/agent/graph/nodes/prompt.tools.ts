import { type ToolSpec } from '../../ports/llm/tool.spec.ts';

/** Quais familias de ferramentas desta execucao o prompt de sistema precisa ensinar (arquivos e relatorios; spec 040). */
export function promptTools(specs: readonly ToolSpec[]): { readonly files?: boolean; readonly reports?: boolean } {
  const has = (name: string): boolean => specs.some((s) => s.name === name);
  return { ...(has('search_files') ? { files: true } : {}), ...(has('write_report') ? { reports: true } : {}) };
}
