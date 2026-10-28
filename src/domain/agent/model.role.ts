/**
 * Papeis de modelo do agente (spec 031, FR-021): `main` responde e analisa, `fast` classifica a
 * intencao e faz tarefas curtas (sem `fast` configurado, as tarefas dele usam o `main`) e
 * `fallback` entra quando o principal falha antes de responder.
 */
export const MODEL_ROLES = ['main', 'fast', 'fallback'] as const;

/** Papel de um perfil de modelo. */
export type ModelRole = (typeof MODEL_ROLES)[number];
