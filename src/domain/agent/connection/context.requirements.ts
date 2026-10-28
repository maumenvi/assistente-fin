/**
 * Janela de contexto exigida pelo assistente (spec 035, R3): o prompt do agente com as ferramentas passa de
 * ~6 mil tokens, entao abaixo de 8 192 ele perde o fio; 16 384 e o recomendado.
 */
export const CONTEXT_REQUIREMENTS = { minTokens: 8192, recommendedTokens: 16384 } as const;
