import { AgentError } from './agent.error.ts';

/** Uma ferramenta de consulta falhou de forma inesperada. */
export class ToolFailedError extends AgentError {
  public readonly tool: string;

  public constructor(tool: string, message = 'ferramenta falhou') {
    super('TOOL_FAILED', `${tool}: ${message}`);
    this.tool = tool;
  }
}
