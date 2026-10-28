/** Evento Server-Sent Events ja montado (HTML Living Standard, 9.2). */
export interface SseEvent {
  /** Tipo do evento; padrao `message`. */
  readonly event: string;
  /** Linhas `data:` unidas por `\n`. */
  readonly data: string;
  /** Ultimo `id` recebido (persiste entre eventos, como no padrao); `null` se nunca houve. */
  readonly id: string | null;
  /** `retry:` recebido junto deste evento, em ms; `null` se nao houve. */
  readonly retry: number | null;
}
