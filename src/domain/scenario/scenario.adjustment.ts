import { Month } from '../shared/month.value.object.ts';
import { InvalidScenarioError } from './invalid.scenario.error.ts';

/** Comprimento maximo do texto livre `label`. */
const MAX_LABEL_LENGTH = 120;

/** O que o ajuste hipotetico afeta na projecao. */
export type ScenarioAdjustmentTarget = 'income' | 'expense';

/** `ScenarioAdjustmentTarget` validos. */
export const SCENARIO_ADJUSTMENT_TARGETS: readonly ScenarioAdjustmentTarget[] = ['income', 'expense'];

/**
 * Como o ajuste incide sobre o valor mensal do alvo:
 * - `add`: soma `amountCents` ao valor daquele mes (aceita negativo = reduzir; `0` nao faz sentido).
 * - `replace`: substitui o valor mensal do alvo por `amountCents` (`>= 0`).
 */
export type ScenarioAdjustmentMode = 'add' | 'replace';

/** `ScenarioAdjustmentMode` validos. */
export const SCENARIO_ADJUSTMENT_MODES: readonly ScenarioAdjustmentMode[] = ['add', 'replace'];

/** Dados para criar um `ScenarioAdjustment`. */
export interface ScenarioAdjustmentProps {
  readonly target: ScenarioAdjustmentTarget;
  readonly mode: ScenarioAdjustmentMode;
  readonly label: string;
  readonly amountCents: number;
  readonly from: Month;
  readonly to: Month;
}

/**
 * Ajuste hipotetico de um cenario de projecao (spec 002, RF-32).
 *
 * Imutavel. Descreve "no intervalo `from..to`, o ganho/gasto mensal muda assim" - so alimenta
 * a projecao (`project.scenario.ts`); nunca toca dado real por si so.
 */
export class ScenarioAdjustment {
  public readonly target: ScenarioAdjustmentTarget;
  public readonly mode: ScenarioAdjustmentMode;
  public readonly label: string;
  public readonly amountCents: number;
  public readonly from: Month;
  public readonly to: Month;

  private constructor(props: ScenarioAdjustmentProps) {
    this.target = props.target;
    this.mode = props.mode;
    this.label = props.label;
    this.amountCents = props.amountCents;
    this.from = props.from;
    this.to = props.to;
  }

  public static create(props: ScenarioAdjustmentProps): ScenarioAdjustment {
    const label = props.label.trim();

    if (!SCENARIO_ADJUSTMENT_TARGETS.includes(props.target)) {
      throw new InvalidScenarioError(`target desconhecido: ${String(props.target)}`);
    }
    if (!SCENARIO_ADJUSTMENT_MODES.includes(props.mode)) {
      throw new InvalidScenarioError(`mode desconhecido: ${String(props.mode)}`);
    }
    if (label === '') throw new InvalidScenarioError('label obrigatorio');
    if (label.length > MAX_LABEL_LENGTH) {
      throw new InvalidScenarioError(`label acima de ${MAX_LABEL_LENGTH} caracteres`);
    }
    if (!Number.isSafeInteger(props.amountCents)) {
      throw new InvalidScenarioError('amountCents deve ser inteiro em centavos');
    }
    if (props.mode === 'add' && props.amountCents === 0) {
      throw new InvalidScenarioError('ajuste "add" com valor 0 nao faz nada');
    }
    if (props.mode === 'replace' && props.amountCents < 0) {
      throw new InvalidScenarioError('ajuste "replace" nao aceita valor negativo');
    }
    if (!(props.from instanceof Month) || !(props.to instanceof Month)) {
      throw new InvalidScenarioError('from e to devem ser Month');
    }
    if (props.from.compare(props.to) === 1) {
      throw new InvalidScenarioError('from deve ser <= to');
    }

    return new ScenarioAdjustment({ ...props, label });
  }

  /** `true` se `month` cai dentro de `from..to` (inclusive nas pontas). */
  public appliesTo(month: Month): boolean {
    return this.from.compare(month) !== 1 && month.compare(this.to) !== 1;
  }
}
