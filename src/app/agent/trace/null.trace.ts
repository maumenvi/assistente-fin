import { type AgentTracePort } from '../ports/observe/agent.trace.port.ts';

/** Trace que descarta tudo (testes e instalacoes sem destino). */
export class NullTrace implements AgentTracePort {
  public emit(): void {
    // descarta
  }

  public flush(): Promise<void> {
    return Promise.resolve();
  }
}
