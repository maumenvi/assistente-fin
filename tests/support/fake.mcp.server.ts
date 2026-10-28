import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { type AddressInfo } from 'node:net';

export type FakeMcpMode = 'json' | 'sse' | 'sse-noisy';

export interface RecordedRequest {
  readonly method: string;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly body: Record<string, unknown> | null;
}

/** Servidor MCP de mentira (Streamable HTTP) com falhas injetaveis, para os testes do transporte e do agente. */
export class FakeMcpServer {
  public mode: FakeMcpMode = 'json';
  public sessions = true;
  public requireToken: string | null = null;
  public redirect = false;
  public bigBody = false;
  public silent = false;
  public interrupt = false;
  public rpcError = false;
  public noTools = false;
  public injectionText: string | null = null;
  public toolDescription = 'Converte um valor entre duas moedas';
  public extraTools: { name: string; description: string }[] = [];
  public readonly requests: RecordedRequest[] = [];
  private server: Server | null = null;
  private currentSession = 'sess-1';
  private expired = false;
  private counter = 1;

  public get url(): string {
    const address = (this.server as Server).address() as AddressInfo;
    return `http://127.0.0.1:${String(address.port)}/mcp`;
  }

  public async start(): Promise<this> {
    this.server = createServer((req, res) => void this.handle(req, res));
    await new Promise<void>((resolve) => (this.server as Server).listen(0, '127.0.0.1', resolve));
    return this;
  }

  public async stop(): Promise<void> {
    await new Promise<void>((resolve) => (this.server === null ? resolve() : this.server.closeAllConnections?.() ?? undefined, this.server?.close(() => resolve()) ?? resolve()));
  }

  /** A proxima chamada com a sessao atual recebe 404 (sessao expirou). */
  public expireSession(): void {
    this.expired = true;
  }

  public initializeCount(): number {
    return this.requests.filter((r) => r.body?.['method'] === 'initialize').length;
  }

  private tools() {
    const base = this.noTools ? [] : [{ name: 'convert', description: this.toolDescription, inputSchema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' }, amount: { type: 'number' } }, required: ['from', 'to', 'amount'] } }];
    return [...base, ...this.extraTools.map((t) => ({ ...t, inputSchema: { type: 'object' } }))];
  }

  private async handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const text = Buffer.concat(chunks).toString('utf8');
    const body = text === '' ? null : (JSON.parse(text) as Record<string, unknown>);
    this.requests.push({ method: req.method ?? '', headers: req.headers, body });
    if (this.redirect) {
      res.writeHead(302, { Location: 'https://outro.exemplo.com/mcp' }).end();
      return;
    }
    if (this.requireToken !== null && req.headers['authorization'] !== `Bearer ${this.requireToken}`) {
      res.writeHead(401).end();
      return;
    }
    if (req.method === 'DELETE') {
      res.writeHead(200).end();
      return;
    }
    const method = body?.['method'] as string | undefined;
    if (this.sessions && method !== 'initialize') {
      if (this.expired || req.headers['mcp-session-id'] !== this.currentSession) {
        this.expired = false;
        res.writeHead(404).end();
        return;
      }
    }
    if (this.silent) return; // nunca responde
    if (method === 'initialize') {
      if (this.sessions) {
        this.counter += 1;
        this.currentSession = this.counter === 2 ? 'sess-1' : `sess-${String(this.counter)}`;
        this.expired = false;
      }
      this.reply(res, body, { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'cambio', version: '1.0.0' } }, this.sessions ? { 'Mcp-Session-Id': this.currentSession } : {});
      return;
    }
    if (method === 'notifications/initialized') {
      res.writeHead(202).end();
      return;
    }
    if (this.rpcError && method === 'tools/call') {
      this.reply(res, body, undefined, {}, { code: -32000, message: 'moeda desconhecida' });
      return;
    }
    if (method === 'tools/list') {
      this.reply(res, body, { tools: this.tools() });
      return;
    }
    if (method === 'tools/call') {
      const args = ((body?.['params'] as Record<string, unknown>)['arguments'] ?? {}) as Record<string, unknown>;
      const amount = Number(args['amount'] ?? 0);
      const base = this.bigBody ? 'x'.repeat(2 * 1024 * 1024) : `1 ${String(args['from'])} = R$ 5,41; total R$ ${(amount * 5.41).toFixed(2).replace('.', ',')}`;
      const out = this.injectionText === null ? base : `${base}\n${this.injectionText}`;
      this.reply(res, body, { content: [{ type: 'text', text: out }] });
      return;
    }
    this.reply(res, body, {});
  }

  private reply(res: ServerResponse, body: Record<string, unknown> | null, result?: unknown, headers: Record<string, string> = {}, error?: { code: number; message: string }): void {
    const message = { jsonrpc: '2.0', id: body?.['id'] ?? null, ...(error === undefined ? { result } : { error }) };
    if (this.interrupt) {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', ...headers });
      res.write(': aquecendo\n\n');
      res.destroy();
      return;
    }
    if (this.mode === 'json') {
      res.writeHead(200, { 'Content-Type': 'application/json', ...headers }).end(JSON.stringify(message));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/event-stream', ...headers });
    if (this.mode === 'sse-noisy') {
      res.write(': keepalive\r\n\r\n');
      res.write(`event: message\r\ndata: ${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/message', params: { level: 'info' } })}\r\n\r\n`);
      res.write(`data: ${JSON.stringify({ jsonrpc: '2.0', id: 999, method: 'sampling/createMessage', params: {} })}\r\n\r\n`);
    }
    res.write(`event: message\ndata: ${JSON.stringify(message)}\n\n`);
    res.end();
  }
}
