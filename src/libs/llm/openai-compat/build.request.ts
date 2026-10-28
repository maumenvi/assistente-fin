import { type ModelOrigin } from '../../../domain/agent/model.origin.ts';
import { type ModelCapabilities } from '../../../domain/agent/model.capabilities.ts';
import { type LlmContentPart } from '../../../app/agent/ports/llm/llm.content.part.ts';
import { type LlmMessage } from '../../../app/agent/ports/llm/llm.message.ts';
import { type LlmRequest } from '../../../app/agent/ports/llm/llm.request.ts';

/** Entrada de `buildRequestBody`. */
export interface BuildRequestInput {
  readonly model: string;
  readonly request: LlmRequest;
  readonly capabilities: ModelCapabilities;
  /** Pede `stream_options.include_usage` e `usage.include` (omitido para servidores locais que nao aceitam). */
  readonly includeUsage: boolean;
  /** Origem do perfil: `openrouter` ganha `provider.require_parameters` com ferramentas; `google` nao recebe o campo `usage` (so do OpenRouter). */
  readonly origin?: ModelOrigin;
}

function mapContent(parts: readonly LlmContentPart[]): string | unknown[] {
  const onlyText = parts.every((p) => p.type === 'text');
  if (onlyText) return parts.map((p) => (p.type === 'text' ? p.text : '')).join('');
  return parts.map((part) =>
    part.type === 'text'
      ? { type: 'text', text: part.text }
      : { type: 'image_url', image_url: { url: `data:${part.mediaType};base64,${part.dataBase64}` } },
  );
}

function mapMessage(message: LlmMessage): Record<string, unknown> {
  if (message.role === 'user') return { role: 'user', content: mapContent(message.content) };
  if (message.role === 'tool') {
    return { role: 'tool', tool_call_id: message.toolCallId, content: message.content };
  }
  const mapped: Record<string, unknown> = { role: 'assistant' };
  const content = mapContent(message.content);
  const hasCalls = (message.toolCalls?.length ?? 0) > 0;
  mapped['content'] = content === '' && hasCalls ? null : content;
  if (hasCalls) {
    mapped['tool_calls'] = message.toolCalls?.map((call) => ({
      id: call.id,
      type: 'function',
      function: { name: call.name, arguments: JSON.stringify(call.args ?? {}) },
      ...(call.extra === undefined ? {} : { extra_content: call.extra }),
    }));
  }
  const state = message.providerState;
  if (typeof state === 'object' && state !== null && 'reasoning_details' in state) {
    mapped['reasoning_details'] = (state as { reasoning_details: unknown }).reasoning_details;
  }
  return mapped;
}

/**
 * Monta o corpo de `POST /chat/completions` (spec 031, contracts/openai-compat.wire.md).
 * `tools`/`tool_choice` so vao quando o modelo suporta ferramentas e ha ferramentas;
 * `response_format` so com `structuredOutput`. Nunca inclui chave de API.
 */
export function buildRequestBody(input: BuildRequestInput): Record<string, unknown> {
  const { model, request, capabilities } = input;
  const body: Record<string, unknown> = {
    model,
    stream: true,
    temperature: request.temperature ?? 0,
    messages: [{ role: 'system', content: request.system }, ...request.messages.map(mapMessage)],
  };
  if (input.includeUsage) {
    body['stream_options'] = { include_usage: true };
    if (input.origin !== 'google') body['usage'] = { include: true };
  }
  if (request.maxOutputTokens !== undefined) body['max_tokens'] = request.maxOutputTokens;
  if (capabilities.tools && request.tools !== undefined && request.tools.length > 0) {
    body['tools'] = request.tools.map((tool) => ({
      type: 'function',
      function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
    }));
    body['tool_choice'] = request.toolChoice ?? 'auto';
    // OpenRouter roteia so para provedores que aceitam `tools`: evita cair num que ignora as ferramentas (spec 035, R2).
    if (input.origin === 'openrouter') body['provider'] = { require_parameters: true };
  }
  if (request.output !== undefined && capabilities.structuredOutput) {
    body['response_format'] = {
      type: 'json_schema',
      json_schema: { name: request.output.name, strict: true, schema: request.output.schema },
    };
  }
  return body;
}
