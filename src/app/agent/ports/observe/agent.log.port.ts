/** Log interno do agente (falhas de gravacao do trace, descartes...). Nunca lanca. */
export interface AgentLogPort {
  warn(message: string, fields?: Readonly<Record<string, unknown>>): void;
  error(message: string, fields?: Readonly<Record<string, unknown>>): void;
}
