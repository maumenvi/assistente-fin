/** Partes de uma URL http(s). Parser proprio: `URL.host`/`origin` nao funcionam no Hermes. */
export interface ParsedHttpUrl {
  readonly protocol: 'http:' | 'https:';
  readonly hostname: string;
  /** `hostname[:porta]` como escrito. */
  readonly host: string;
  readonly port: number | null;
  readonly path: string;
}

const PATTERN = /^(https?):\/\/(\[[0-9a-fA-F:]+\]|[A-Za-z0-9.-]+)(?::(\d{1,5}))?(\/[^\s?#]*)?(\?[^\s#]*)?(#\S*)?$/;

/** `null` quando nao e uma URL http(s) simples (sem usuario/senha embutidos). */
export function parseHttpUrl(url: string): ParsedHttpUrl | null {
  const m = PATTERN.exec(url.trim());
  if (m === null) return null;
  const hostname = (m[2] as string).toLowerCase();
  const port = m[3] === undefined ? null : Number(m[3]);
  if (port !== null && port > 65535) return null;
  return { protocol: `${(m[1] as string).toLowerCase()}:` as 'http:' | 'https:', hostname, host: port === null ? hostname : `${hostname}:${String(port)}`, port, path: `${m[4] ?? '/'}${m[5] ?? ''}` };
}

/** Maquina local (desenvolvimento): `localhost`, `127.0.0.1` e `[::1]`. */
export function isLocalHost(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}
