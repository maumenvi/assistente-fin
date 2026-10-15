import { isValidOptionalDate } from '../shared/is.valid.optional.date.ts';
import { ScenarioAdjustment } from './scenario.adjustment.ts';
import { InvalidScenarioError } from './invalid.scenario.error.ts';

/** Comprimento maximo do nome do cenario. */
const MAX_NAME_LENGTH = 120;

/** Limites do horizonte de projecao, em meses. */
const MIN_HORIZON_MONTHS = 1;
const MAX_HORIZON_MONTHS = 60;

/** Dados necessarios para criar um cenario de projecao. */
export interface CreateProjectionScenarioProps {
  readonly id: string;
  readonly userId: string;
  readonly name: string;
  readonly adjustments: readonly ScenarioAdjustment[];
  readonly horizonMonths: number;
}

/** Dados de um cenario ja persistido: iguais aos de criacao + a versao da trava otimista. */
export interface ProjectionScenarioPersistenceProps extends CreateProjectionScenarioProps {
  /** Versao para trava otimista (spec 002, RF-31). `null`/ausente = nunca persistido. */
  readonly updatedAt?: Date | null;
}

/**
 * Cenario de projecao salvo ("Simulacao geral", spec 002, RF-32, RF-34, RF-36).
 *
 * Imutavel. So guarda a definicao (nome, ajustes, horizonte) - a projecao em si e calculada
 * por `project.scenario.ts` (funcao pura) contra o estado atual do banco. `create` e
 * `fromPersistence` validam as mesmas invariantes (defesa em profundidade, CA-19/CA-20).
 */
export class ProjectionScenario {
  public readonly id: string;
  public readonly userId: string;
  public readonly name: string;
  public readonly adjustments: readonly ScenarioAdjustment[];
  public readonly horizonMonths: number;
  /** Versao lida do banco (trava otimista, RF-31); `null` enquanto nao foi persistido. */
  public readonly updatedAt: Date | null;

  private constructor(props: ProjectionScenarioPersistenceProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.name = props.name;
    this.adjustments = props.adjustments;
    this.horizonMonths = props.horizonMonths;
    this.updatedAt = props.updatedAt ?? null;
  }

  public static create(props: CreateProjectionScenarioProps): ProjectionScenario {
    return ProjectionScenario.build(props);
  }

  /** Reconstroi um cenario ja persistido, reaplicando as mesmas invariantes de `create`. */
  public static fromPersistence(props: ProjectionScenarioPersistenceProps): ProjectionScenario {
    return ProjectionScenario.build(props);
  }

  /** Devolve o mesmo cenario com outro `updatedAt` - usado pelos adaptadores ao (re)carimbar. */
  public withUpdatedAt(updatedAt: Date | null): ProjectionScenario {
    return ProjectionScenario.build({ ...this.props(), updatedAt });
  }

  private static build(props: ProjectionScenarioPersistenceProps): ProjectionScenario {
    const id = props.id.trim();
    const userId = props.userId.trim();
    const name = props.name.trim();

    if (id === '') throw new InvalidScenarioError('id obrigatorio');
    if (userId === '') throw new InvalidScenarioError('userId obrigatorio');
    if (name === '') throw new InvalidScenarioError('name obrigatorio');
    if (name.length > MAX_NAME_LENGTH) {
      throw new InvalidScenarioError(`name acima de ${MAX_NAME_LENGTH} caracteres`);
    }
    if (!Array.isArray(props.adjustments) || props.adjustments.length === 0) {
      throw new InvalidScenarioError('adjustments deve ter ao menos um ajuste');
    }
    if (!props.adjustments.every((adjustment) => adjustment instanceof ScenarioAdjustment)) {
      throw new InvalidScenarioError('adjustments deve conter apenas ScenarioAdjustment');
    }
    if (
      !Number.isInteger(props.horizonMonths) ||
      props.horizonMonths < MIN_HORIZON_MONTHS ||
      props.horizonMonths > MAX_HORIZON_MONTHS
    ) {
      throw new InvalidScenarioError(
        `horizonMonths deve ser inteiro entre ${MIN_HORIZON_MONTHS} e ${MAX_HORIZON_MONTHS}`,
      );
    }
    if (!isValidOptionalDate(props.updatedAt)) {
      throw new InvalidScenarioError('updatedAt deve ser null ou uma data valida');
    }

    return new ProjectionScenario({
      id,
      userId,
      name,
      adjustments: [...props.adjustments],
      horizonMonths: props.horizonMonths,
      updatedAt: props.updatedAt ?? null,
    });
  }

  private props(): ProjectionScenarioPersistenceProps {
    return {
      id: this.id,
      userId: this.userId,
      name: this.name,
      adjustments: this.adjustments,
      horizonMonths: this.horizonMonths,
      updatedAt: this.updatedAt,
    };
  }
}
