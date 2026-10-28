import { type LlmPort } from '../ports/llm/llm.port.ts';

/** Modelos ja montados por papel; `fast` e opcional. */
export interface RoleModels {
  readonly main: LlmPort;
  readonly fast?: LlmPort | undefined;
}
