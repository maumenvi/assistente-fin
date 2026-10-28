import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { type AddressInfo } from 'node:net';

/** Requisicao recebida pelo servidor de teste. */
export interface RecordedRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: IncomingMessage['headers'];
  readonly body: string;
}

/** Servidor HTTP local que simula um provedor OpenAI-compativel. */
export interface LocalLlmServer {
  /** Base para o adaptador (termina em `/v1`). */
  readonly baseUrl: string;
  readonly requests: RecordedRequest[];
  /** Conexoes que o cliente fechou antes de o servidor terminar. */
  readonly aborted: { count: number };
  close(): Promise<void>;
}

export type LocalLlmHandler = (request: RecordedRequest, response: ServerResponse) => void | Promise<void>;

/** Sobe um servidor em porta livre de 127.0.0.1 que delega cada requisicao ao `handler`. */
export async function startLocalLlmServer(handler: LocalLlmHandler): Promise<LocalLlmServer> {
  const requests: RecordedRequest[] = [];
  const aborted = { count: 0 };
  const sockets = new Set<import('node:net').Socket>();
  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    res.on('close', () => {
      if (!res.writableEnded) aborted.count += 1;
    });
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const recorded: RecordedRequest = {
        method: req.method ?? '',
        url: req.url ?? '',
        headers: req.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      };
      requests.push(recorded);
      void Promise.resolve(handler(recorded, res)).catch(() => res.destroy());
    });
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}/v1`,
    requests,
    aborted,
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      }),
  };
}

/** Cabecalhos de uma resposta SSE. */
export function startSse(res: ServerResponse): void {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
}

/** Escreve um evento `data:` com o objeto serializado. */
export function sendChunk(res: ServerResponse, chunk: unknown): void {
  res.write(`data: ${JSON.stringify(chunk)}\n\n`);
}

/** Escreve o sentinela e fecha a resposta. */
export function sendDone(res: ServerResponse): void {
  res.write('data: [DONE]\n\n');
  res.end();
}

/** Resposta de erro HTTP com corpo JSON no formato do provedor. */
export function sendHttpError(res: ServerResponse, status: number, message: string, headers: Record<string, string> = {}): void {
  res.writeHead(status, { 'content-type': 'application/json', ...headers });
  res.end(JSON.stringify({ error: { code: status, message } }));
}

/** Espera `ms` (para roteiros com atraso). */
export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
