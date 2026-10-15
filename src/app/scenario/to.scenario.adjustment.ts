import { ScenarioAdjustment } from '../../domain/scenario/scenario.adjustment.ts';
import { Month } from '../../domain/shared/month.value.object.ts';
import { type ScenarioAdjustmentInput } from './scenario.adjustment.schema.ts';

/** Entrada de ajuste ja validada -> VO de dominio. Compartilhado por simulate/save/update. */
export function toScenarioAdjustment(input: ScenarioAdjustmentInput): ScenarioAdjustment {
  return ScenarioAdjustment.create({
    target: input.target,
    mode: input.mode,
    label: input.label,
    amountCents: input.amountCents,
    from: Month.create(input.from),
    to: Month.create(input.to),
  });
}
