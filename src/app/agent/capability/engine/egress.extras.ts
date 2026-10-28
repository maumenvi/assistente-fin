import { type McpTool } from '../ports/mcp.client.port.ts';

/** Nomes dos campos de entrada de todas as ferramentas (propriedades do `inputSchema`), sem repetir. */
export function inputFieldNames(tools: readonly McpTool[]): string[] {
  const names = new Set<string>();
  for (const tool of tools) {
    const schema = tool.inputSchema;
    if (schema === null || typeof schema !== 'object') continue;
    const properties = (schema as { properties?: unknown }).properties;
    if (properties !== null && typeof properties === 'object') for (const key of Object.keys(properties)) names.add(key);
  }
  return [...names];
}

/**
 * Campos de entrada ALEM do declarado (contracts/capability.lifecycle.md, passo 6): o catalogo declara quantos
 * dados saem (`declaredEgress`); se as ferramentas pedem mais campos que isso, os excedentes viram aviso e o
 * usuario reaprova ja vendo a diferenca. Sem declaracao nada e comparado (o passo extra de confirmacao cobre).
 */
export function extraInputs(declaredEgress: readonly string[], tools: readonly McpTool[]): string[] {
  if (declaredEgress.length === 0) return [];
  return inputFieldNames(tools).slice(declaredEgress.length);
}
