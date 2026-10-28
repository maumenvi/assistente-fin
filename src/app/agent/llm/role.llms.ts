import { type ModelProfile } from '../../../domain/agent/model.profile.ts';
import { type LlmPort } from '../ports/llm/llm.port.ts';
import { type RoleModels } from './role.models.ts';

/** Modelos montados para uma execucao, com os perfis de onde vieram. */
export interface RoleLlms extends RoleModels {
  readonly fallback: LlmPort | null;
  readonly fallbackProfile: ModelProfile | null;
  readonly mainProfile: ModelProfile;
  readonly fastProfile: ModelProfile | null;
}
