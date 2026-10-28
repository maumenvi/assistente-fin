import { type ConsentRecord } from '../../../domain/agent/consent.record.ts';
import { type FetchFn } from '../../../libs/llm/fetch.fn.ts';
import { type OpenAiCompatOptions } from '../../../libs/llm/openai-compat/openai.compat.options.ts';
import { type SecretStorePort } from '../ports/settings/secret.store.port.ts';

/** Dependencias de `createLlmPort`: tudo que vem da borda (segredo, fetch, consentimento). */
export interface CreateLlmPortDeps {
  readonly secrets: SecretStorePort;
  /** `fetch` da plataforma (global no desktop, `expo/fetch` no Android). */
  readonly fetchFn: FetchFn;
  /** "Usar somente modelos locais" (FR-028). */
  readonly localOnly: boolean;
  /** Consentimento de nuvem registrado, se houver. */
  readonly consent: ConsentRecord | null;
  /** Versao do texto de consentimento vigente; consentimento de outra versao nao vale. */
  readonly consentTextVersion: string;
  /** Ajustes extras do adaptador (tempos, retentativas), usados em testes. */
  readonly adapter?: Partial<OpenAiCompatOptions>;
}
