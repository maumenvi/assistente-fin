/** Etapas do teste de conexao (spec 035), sempre nesta ordem. */
export const CONNECTION_STEP_IDS = ['reach', 'key', 'model', 'tools', 'context'] as const;

/** Identificador de uma etapa do teste de conexao. */
export type ConnectionStepId = (typeof CONNECTION_STEP_IDS)[number];
