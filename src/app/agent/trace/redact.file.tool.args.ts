/** Ferramentas de arquivo que carregam conteudo nos argumentos (spec 040): o trace guarda so o caminho. */
const WRITING_FILE_TOOLS = new Set(['create_file', 'edit_file']);

/** Argumentos de uma chamada como vao ao trace/log: sem o conteudo gravado em arquivo. */
export function redactFileToolArgs(name: string, args: unknown): unknown {
  if (!WRITING_FILE_TOOLS.has(name) || typeof args !== 'object' || args === null) return args;
  const path = (args as { path?: unknown }).path;
  return { path: typeof path === 'string' ? path : null, conteudo: '[omitido]' };
}
