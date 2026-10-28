import { type AutoActionKey } from '../plan/auto.action.key.ts';
import { type AutonomyRule } from './autonomy.rule.ts';

/** Politica local de autonomia do aparelho (spec 033, data-model.md 5). Nunca sincroniza. */
export interface AutonomyPolicy {
  readonly userId: string;
  readonly rules: Readonly<Record<AutoActionKey, AutonomyRule>>;
  readonly validityHours: number;
  readonly undoDays: number;
  readonly updatedAt: string;
}
