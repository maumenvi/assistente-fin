import { type ToolLimits } from '../ports/tool/tool.limits.ts';

/** Limites padrao de uma ferramenta: 30 itens na amostra, 12.000 caracteres e 30 s (contracts/tool.port.md). */
export const DEFAULT_TOOL_LIMITS: ToolLimits = Object.freeze({ maxItems: 30, maxChars: 12_000, timeoutMs: 30_000 });
