import { type ModelCapabilities } from '../../../domain/agent/model.capabilities.ts';
import { type ModelOrigin } from '../../../domain/agent/model.origin.ts';
import { type FetchFn } from '../fetch.fn.ts';
import { type LlmTimeouts } from '../llm.timeouts.ts';
import { type RetryDeps } from '../retry.deps.ts';
import { type RetryOptions } from '../retry.options.ts';

/** Opcoes do adaptador OpenAI-compativel (OpenRouter, Ollama, llama.cpp, LM Studio, vLLM). */
export interface OpenAiCompatOptions {
  readonly baseUrl: string;
  readonly model: string;
  /** Origem do perfil (ajusta o corpo do pedido: `openrouter`/`google`); ausente = comportamento generico. */
  readonly origin?: ModelOrigin;
  /** Ausente para servidores locais. Nunca e registrada em log nem em erro. */
  readonly apiKey?: string;
  readonly capabilities: ModelCapabilities;
  readonly fetchFn: FetchFn;
  /** Cabecalhos extras (ex.: `X-Title` do OpenRouter). */
  readonly extraHeaders?: Readonly<Record<string, string>>;
  /** Pede `usage.include`/`stream_options` (padrao: so para servidores nao locais). */
  readonly includeUsage?: boolean;
  readonly timeouts?: LlmTimeouts;
  readonly retry?: RetryOptions;
  readonly retryDeps?: RetryDeps;
  readonly now?: () => Date;
}
