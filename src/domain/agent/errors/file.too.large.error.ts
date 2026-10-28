import { AgentError } from './agent.error.ts';

/** O arquivo passa do limite de leitura do assistente (spec 040). */
export class FileTooLargeError extends AgentError {
  public constructor(limitBytes: number) {
    super('FILE_TOO_LARGE', `o arquivo passa de ${Math.round(limitBytes / 1024 / 1024)} MB`);
  }
}
