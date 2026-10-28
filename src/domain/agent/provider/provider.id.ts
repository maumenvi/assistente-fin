/** Provedores do assistente simples (spec 035). Lista fechada em codigo; acrescentar um = novo arquivo `provider.<id>.ts`. */
export const PROVIDER_IDS = ['openrouter', 'google', 'ollama'] as const;

/** Identificador de provedor. */
export type ProviderId = (typeof PROVIDER_IDS)[number];
