import { type JsonSchema } from './json.schema.ts';

/** Ferramenta como o modelo a enxerga: nome, descricao (escrita como prompt) e schema de entrada. */
export interface ToolSpec {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
}
