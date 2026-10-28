import { type ToolSpec } from '../ports/llm/tool.spec.ts';
import { type AnyAgentTool } from './agent.tool.ts';
import { toToolJsonSchema } from './to.tool.json.schema.ts';

/** Conjunto validado de ferramentas do agente. */
export interface ToolRegistry {
  /** Specs enviadas ao modelo (JSON Schema ja gerado, em cache). */
  list(): readonly ToolSpec[];
  get(id: string): AnyAgentTool | undefined;
}

/** Efeitos que um registro aceita; o padrao e so leitura (escrita e da spec 033). */
export type ToolEffect = AnyAgentTool['effect'];

/**
 * Valida e indexa as ferramentas (spec 031, contracts/tool.port.md): ids snake_case unicos,
 * descricao presente, **apenas os efeitos permitidos** (padrao `read`; o registro de memoria da
 * spec 032 permite `memory`) e schema sem `userId` (o usuario vem sempre da sessao). Lanca
 * `Error` claro no primeiro problema.
 */
export function createToolRegistry(tools: readonly AnyAgentTool[], allow: readonly ToolEffect[] = ['read']): ToolRegistry {
  const byId = new Map<string, AnyAgentTool>();
  const specs: ToolSpec[] = [];
  for (const tool of tools) {
    if (!/^[a-z][a-z0-9_]*$/.test(tool.id)) throw new Error(`ferramenta "${tool.id}": id deve ser snake_case`);
    if (byId.has(tool.id)) throw new Error(`ferramenta "${tool.id}" duplicada`);
    if (tool.description.trim() === '') throw new Error(`ferramenta "${tool.id}": descricao obrigatoria`);
    if (!allow.includes(tool.effect)) throw new Error(`ferramenta "${tool.id}": efeito "${tool.effect}" nao e permitido neste registro (escrita e da spec 033)`);
    const inputSchema = toToolJsonSchema(tool.input);
    const properties = (inputSchema['properties'] ?? {}) as Record<string, unknown>;
    if ('userId' in properties) throw new Error(`ferramenta "${tool.id}": o schema nao pode ter userId`);
    byId.set(tool.id, tool);
    specs.push({ name: tool.id, description: tool.description, inputSchema });
  }
  return { list: () => specs, get: (id) => byId.get(id) };
}
