import { type SseEvent } from './sse.event.ts';

/**
 * Parser SSE incremental (spec 031, D4; padrao do HTML Living Standard, 9.2). Recebe TEXTO ja
 * decodificado em qualquer fatiamento e devolve os eventos completos. Nunca lanca.
 *
 * Terminadores `\r\n`, `\n` e `\r` (inclusive um `\r\n` partido entre chunks); campos `data`,
 * `event`, `id`, `retry`; comentario `:`; BOM inicial ignorado; evento so e despachado numa linha
 * em branco e se houver ao menos um `data`.
 */
export class SseParser {
  private buffer = '';
  private started = false;
  private skipLf = false;
  private dataLines: string[] = [];
  private dataLength = 0;
  private eventType = '';
  private lastId: string | null = null;
  private retry: number | null = null;

  /** Tamanho (em caracteres) da linha parcial ainda sem terminador. */
  public get partialLineLength(): number {
    return this.buffer.length;
  }

  /** Tamanho (em caracteres) dos `data` acumulados do evento em montagem. */
  public get eventDataLength(): number {
    return this.dataLength;
  }

  public push(text: string): SseEvent[] {
    let chunk = text;
    if (!this.started && chunk.length > 0) {
      this.started = true;
      if (chunk.charCodeAt(0) === 0xfeff) chunk = chunk.slice(1);
    }
    if (this.skipLf && chunk.length > 0) {
      if (chunk.charCodeAt(0) === 0x0a) chunk = chunk.slice(1);
      this.skipLf = false;
    }
    this.buffer += chunk;
    const events: SseEvent[] = [];
    let start = 0;
    for (let i = 0; i < this.buffer.length; i += 1) {
      const code = this.buffer.charCodeAt(i);
      if (code !== 0x0a && code !== 0x0d) continue;
      const line = this.buffer.slice(start, i);
      if (code === 0x0d) {
        if (i + 1 < this.buffer.length) {
          if (this.buffer.charCodeAt(i + 1) === 0x0a) i += 1;
        } else {
          this.skipLf = true;
        }
      }
      start = i + 1;
      const event = this.processLine(line);
      if (event !== null) events.push(event);
    }
    this.buffer = this.buffer.slice(start);
    return events;
  }

  /** Fim do stream: um evento sem linha em branco final NAO e despachado (padrao). Zera o estado. */
  public flush(): SseEvent[] {
    this.buffer = '';
    this.skipLf = false;
    this.dataLines = [];
    this.dataLength = 0;
    this.eventType = '';
    this.retry = null;
    return [];
  }

  private processLine(line: string): SseEvent | null {
    if (line === '') return this.dispatch();
    if (line.charCodeAt(0) === 0x3a) return null;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.charCodeAt(0) === 0x20) value = value.slice(1);
    switch (field) {
      case 'data':
        this.dataLines.push(value);
        this.dataLength += value.length + 1;
        break;
      case 'event':
        this.eventType = value;
        break;
      case 'id':
        if (!value.includes('\u0000')) this.lastId = value;
        break;
      case 'retry':
        if (/^\d+$/.test(value)) this.retry = Number.parseInt(value, 10);
        break;
      default:
        break;
    }
    return null;
  }

  private dispatch(): SseEvent | null {
    if (this.dataLines.length === 0) {
      this.eventType = '';
      this.retry = null;
      return null;
    }
    const event: SseEvent = {
      event: this.eventType === '' ? 'message' : this.eventType,
      data: this.dataLines.join('\n'),
      id: this.lastId,
      retry: this.retry,
    };
    this.dataLines = [];
    this.dataLength = 0;
    this.eventType = '';
    this.retry = null;
    return event;
  }
}
