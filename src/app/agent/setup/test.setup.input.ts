import { type ModelRole } from '../../../domain/agent/model.role.ts';
import { type SetupDraft } from './setup.draft.ts';

/** Entrada de `TestSetupUseCase`. `role` testa tambem o rapido/alternativo (Avancado). */
export interface TestSetupInput {
  readonly userId: string;
  readonly draft: SetupDraft;
  readonly role?: ModelRole | undefined;
}
