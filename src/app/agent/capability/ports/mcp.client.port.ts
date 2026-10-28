/** Endereco de um servidor MCP remoto; `allowInsecureLocal` libera `http` so para a maquina local (desenvolvimento). */
export interface McpEndpoint {
  readonly url: string;
  readonly allowInsecureLocal: boolean;
}

/** Cabecalhos de credencial montados a partir do cofre; nunca serializados nem logados. */
export interface McpAuth {
  readonly headers: Readonly<Record<string, string>>;
}

export interface McpServerInfo {
  readonly name: string;
  readonly version?: string | undefined;
}

/** Conexao aberta (a sessao e interna ao cliente). */
export interface McpConnection {
  readonly serverInfo: McpServerInfo;
}

export interface McpTool {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: unknown;
}

export interface McpToolResult {
  readonly text: string;
  readonly isError: boolean;
  readonly bytes: number;
}

/** Cliente MCP remoto (Streamable HTTP). Falhas viram erros tipados de `libs/mcp`. */
export interface McpClientPort {
  connect(endpoint: McpEndpoint, auth: McpAuth, signal?: AbortSignal): Promise<McpConnection>;
  listTools(connection: McpConnection, signal?: AbortSignal): Promise<McpTool[]>;
  callTool(connection: McpConnection, name: string, args: Readonly<Record<string, unknown>>, signal?: AbortSignal): Promise<McpToolResult>;
  close(connection: McpConnection): Promise<void>;
}
