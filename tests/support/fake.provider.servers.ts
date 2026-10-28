import { type ServerResponse } from 'node:http';
import { type AddressInfo } from 'node:net';
import { createServer, type Server } from 'node:http';

/** Provedor imitado (spec 035): cada um com seu formato de `/models`, de erro e de ferramentas. */
export type FakeProviderKind = 'openrouter' | 'google' | 'ollama';

/** Estado da chave imitada. */
/** Vence 2 dias depois do relogio fixo dos testes de configuracao (2026-10-23): nao depende de quando o teste roda. */
const EXPIRING_KEY_AT = '2026-10-25T12:00:00.000Z';

export type FakeKeyState = 'ok' | 'no_credit' | 'expired' | 'expiring';

export interface FakeProviderOptions {
  readonly kind: FakeProviderKind;
  /** Chaves aceitas (ignorado no Ollama). Padrao `['good-key']`. */
  readonly validKeys?: readonly string[];
  /** Ids listados em `/models` (Google os devolve com o prefixo `models/`). */
  readonly models?: readonly string[];
  /** Quais modelos chamam ferramentas na sonda; padrao: todos. */
  readonly supportsTools?: (model: string) => boolean;
  readonly keyState?: FakeKeyState;
  /** Ollama: janela de contexto carregada (`/api/ps`) e o corte de `prompt_tokens`. Padrao 16384. */
  readonly contextTokens?: number;
  /** Ollama: `/api/ps` responde 404 (servidor sem essa rota) para exercitar a sonda de enchimento. */
  readonly hideProcessInfo?: boolean;
  /** Resposta do chat em streaming; padrao texto fixo. Recebe o corpo do pedido. */
  readonly streamReply?: (body: Record<string, unknown>) => FakeStreamReply;
}

/** O que o chat em streaming devolve: texto, ou uma chamada de ferramenta. */
export type FakeStreamReply =
  | { readonly text: string }
  | { readonly toolCall: { readonly name: string; readonly args: unknown } }
  /** Corpo SSE cru (linhas `data:` ja montadas), para simular formatos fora do padrao. */
  | { readonly raw: string };

export interface FakeRequest {
  readonly method: string;
  readonly url: string;
  readonly authorization: string | undefined;
  readonly body: Record<string, unknown> | null;
}

export interface FakeProvider {
  /** Endereco base como o app o usa (OpenRouter `/api/v1`, Google `/v1beta/openai`, Ollama `/v1`). */
  readonly baseUrl: string;
  readonly requests: FakeRequest[];
  /** Troca o estado da chave no meio do teste. */
  setKeyState(state: FakeKeyState): void;
  /** Troca as chaves aceitas (revogar = lista vazia). */
  setValidKeys(keys: readonly string[]): void;
  /** Faz o chat em streaming falhar com este status HTTP (`null` volta ao normal). */
  setChatStatus(status: number | null): void;
  close(): Promise<void>;
}

const BASE_PATH: Record<FakeProviderKind, string> = { openrouter: '/api/v1', google: '/v1beta/openai', ollama: '/v1' };

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function authError(res: ServerResponse, kind: FakeProviderKind, message = 'invalid key'): void {
  if (kind === 'google') return json(res, 400, [{ error: { code: 400, message: 'API key not valid. Please pass a valid API key.', status: 'INVALID_ARGUMENT' } }]);
  json(res, 401, { error: { code: 401, message } });
}

/** Sobe um provedor de mentira em porta livre de 127.0.0.1. */
export async function startFakeProvider(options: FakeProviderOptions): Promise<FakeProvider> {
  const { kind } = options;
  let validKeys: readonly string[] = options.validKeys ?? ['good-key'];
  let chatStatus: number | null = null;
  const models = options.models ?? (kind === 'ollama' ? ['qwen3:8b'] : kind === 'google' ? ['gemini-3.8-flash'] : ['openrouter/auto', 'google/gemini-2.5-flash']);
  const supportsTools = options.supportsTools ?? (() => true);
  const contextTokens = options.contextTokens ?? 16384;
  let keyState: FakeKeyState = options.keyState ?? 'ok';
  const requests: FakeRequest[] = [];
  const sockets = new Set<import('node:net').Socket>();

  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      let body: Record<string, unknown> | null = null;
      try {
        body = raw === '' ? null : (JSON.parse(raw) as Record<string, unknown>);
      } catch {
        body = null;
      }
      const url = req.url ?? '';
      const authorization = req.headers.authorization;
      requests.push({ method: req.method ?? '', url, authorization, body });
      const path = url.split('?')[0] ?? '';
      const needsKey = kind !== 'ollama';
      const keyOk = !needsKey || (authorization !== undefined && validKeys.includes(authorization.replace(/^Bearer\s+/i, '')));

      if (kind === 'ollama' && path === '/api/ps' && options.hideProcessInfo !== true) return json(res, 200, { models: models.map((m) => ({ name: m, model: m, context_length: contextTokens })) });
      if (kind === 'ollama' && path === '/api/tags') return json(res, 200, { models: models.map((m) => ({ name: m, model: m })) });
      if (kind === 'openrouter' && path === `${BASE_PATH.openrouter}/auth/key`) {
        if (!keyOk || keyState === 'expired') return authError(res, kind, keyState === 'expired' ? 'API key expired' : 'invalid key');
        const expiresAt = keyState === 'expiring' ? EXPIRING_KEY_AT : null;
        return json(res, 200, { data: { label: 'fake', limit: 5, limit_remaining: keyState === 'no_credit' ? 0 : 4.5, expires_at: expiresAt } });
      }
      if (!keyOk) return authError(res, kind);
      if (path.endsWith('/models')) {
        const ids = kind === 'google' ? models.map((m) => `models/${m}`) : models;
        return json(res, 200, { data: ids.map((id) => ({ id, ...(kind === 'openrouter' ? { context_length: 128000, supported_parameters: supportsTools(id) ? ['tools'] : [] } : {}) })) });
      }
      if (path.endsWith('/chat/completions') && body !== null) {
        if (keyState === 'expired') return authError(res, kind, 'API key expired');
        if (keyState === 'no_credit') return json(res, 402, { error: { code: 402, message: 'Insufficient credits' } });
        if (chatStatus !== null && body['stream'] !== false) return json(res, chatStatus, { error: { code: chatStatus, message: 'falha simulada' } });
        const model = String(body['model'] ?? '');
        if (!models.includes(model) && !models.includes(`models/${model}`)) return json(res, 404, { error: { code: 404, message: 'model not found' } });
        const hasTools = Array.isArray(body['tools']) && (body['tools'] as unknown[]).length > 0;
        if (body['stream'] === false) {
          const filler = JSON.stringify(body['messages'] ?? '').length > 15000;
          const usage = { prompt_tokens: filler ? Math.min(9000, contextTokens) : 30, completion_tokens: 1 };
          if (hasTools && supportsTools(model)) {
            return json(res, 200, { usage, choices: [{ message: { content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'ping', arguments: '{"echo":"ok"}' } }] } }] });
          }
          return json(res, 200, { usage, choices: [{ message: { content: 'ok' } }] });
        }
        const reply: FakeStreamReply = options.streamReply?.(body) ?? { text: 'Resposta de teste.' };
        res.writeHead(200, { 'content-type': 'text/event-stream' });
        const send = (chunk: unknown) => res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        if ('raw' in reply) {
          res.write(reply.raw);
        } else if ('toolCall' in reply) {
          // Google omite `index` e `id` (spec 035, R4)
          const call = kind === 'google' ? { function: { name: reply.toolCall.name, arguments: JSON.stringify(reply.toolCall.args) } } : { index: 0, id: 'call_a', type: 'function', function: { name: reply.toolCall.name, arguments: JSON.stringify(reply.toolCall.args) } };
          send({ choices: [{ index: 0, delta: { role: 'assistant', tool_calls: [call] }, finish_reason: null }] });
          send({ choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 20, completion_tokens: 5 } });
        } else {
          send({ choices: [{ index: 0, delta: { role: 'assistant', content: reply.text }, finish_reason: null }] });
          send({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 20, completion_tokens: 5 } });
        }
        res.write('data: [DONE]\n\n');
        return res.end();
      }
      json(res, 404, { error: { code: 404, message: 'rota desconhecida' } });
    });
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}${BASE_PATH[kind]}`,
    requests,
    setKeyState: (state) => {
      keyState = state;
    },
    setValidKeys: (keys) => {
      validKeys = keys;
    },
    setChatStatus: (status) => {
      chatStatus = status;
    },
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      }),
  };
}
