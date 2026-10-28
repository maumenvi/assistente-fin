export const CAPABILITY_KINDS = ['mcp', 'skill'] as const;

/** Tipo de capacidade externa (spec 034): servidor MCP remoto ou skill de instrucoes. */
export type CapabilityKind = (typeof CAPABILITY_KINDS)[number];
