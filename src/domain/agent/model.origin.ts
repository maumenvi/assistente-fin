/**
 * Origem de um modelo (spec 031, FR-020): `openrouter` e `google` (spec 035, Google AI Studio por interface
 * compativel) sao nuvem (exigem consentimento antes do primeiro envio); `openai_compat_local` e um servidor local (Ollama, llama.cpp...) so no desktop,
 * sem dados saindo da maquina.
 */
export const MODEL_ORIGINS = ['openrouter', 'google', 'openai_compat_local'] as const;

/** Origem de um perfil de modelo. */
export type ModelOrigin = (typeof MODEL_ORIGINS)[number];
