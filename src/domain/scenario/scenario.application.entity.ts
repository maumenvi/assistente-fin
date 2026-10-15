import { InvalidScenarioApplicationError } from './invalid.scenario.application.error.ts';

/** Dados necessarios para registrar a aplicacao de um cenario. */
export interface CreateScenarioApplicationProps {
  readonly id: string;
  readonly userId: string;
  readonly scenarioId: string;
  /** Snapshot gravado imediatamente antes de aplicar (RF-37). */
  readonly snapshotId: string;
  readonly appliedAt: Date;
  /** Ids dos ganhos criados por esta aplicacao (base do "desfazer removendo lancamentos", RF-38). */
  readonly createdIncomeIds: readonly string[];
  /** Ids dos gastos fixos criados por esta aplicacao. */
  readonly createdFixedExpenseIds: readonly string[];
}

/** Dados de uma aplicacao ja persistida (iguais aos de criacao - nao ha mutacao). */
export type ScenarioApplicationPersistenceProps = CreateScenarioApplicationProps;

/**
 * "Recibo" da aplicacao de um cenario (spec 002, RF-37, RF-38, RF-40).
 *
 * Imutavel e sem transicoes: nasce no `ApplyScenario` e some no `RevertScenarioApplication`.
 * Enquanto existe uma linha destas para o usuario, ha uma aplicacao ativa (RF-40); no maximo
 * uma por usuario. Guarda o `snapshotId` e os ids do que criou - os dois caminhos de desfazer.
 */
export class ScenarioApplication {
  public readonly id: string;
  public readonly userId: string;
  public readonly scenarioId: string;
  public readonly snapshotId: string;
  public readonly appliedAt: Date;
  public readonly createdIncomeIds: readonly string[];
  public readonly createdFixedExpenseIds: readonly string[];

  private constructor(props: CreateScenarioApplicationProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.scenarioId = props.scenarioId;
    this.snapshotId = props.snapshotId;
    this.appliedAt = props.appliedAt;
    this.createdIncomeIds = props.createdIncomeIds;
    this.createdFixedExpenseIds = props.createdFixedExpenseIds;
  }

  public static create(props: CreateScenarioApplicationProps): ScenarioApplication {
    return ScenarioApplication.build(props);
  }

  /** Reconstroi uma aplicacao ja persistida, reaplicando as mesmas invariantes. */
  public static fromPersistence(props: ScenarioApplicationPersistenceProps): ScenarioApplication {
    return ScenarioApplication.build(props);
  }

  private static build(props: CreateScenarioApplicationProps): ScenarioApplication {
    const id = props.id.trim();
    const userId = props.userId.trim();
    const scenarioId = props.scenarioId.trim();
    const snapshotId = props.snapshotId.trim();

    if (id === '') throw new InvalidScenarioApplicationError('id obrigatorio');
    if (userId === '') throw new InvalidScenarioApplicationError('userId obrigatorio');
    if (scenarioId === '') throw new InvalidScenarioApplicationError('scenarioId obrigatorio');
    if (snapshotId === '') throw new InvalidScenarioApplicationError('snapshotId obrigatorio');
    if (!(props.appliedAt instanceof Date) || Number.isNaN(props.appliedAt.getTime())) {
      throw new InvalidScenarioApplicationError('appliedAt deve ser uma data valida');
    }
    if (!isIdArray(props.createdIncomeIds)) {
      throw new InvalidScenarioApplicationError('createdIncomeIds deve ser uma lista de ids nao vazios');
    }
    if (!isIdArray(props.createdFixedExpenseIds)) {
      throw new InvalidScenarioApplicationError(
        'createdFixedExpenseIds deve ser uma lista de ids nao vazios',
      );
    }

    return new ScenarioApplication({
      id,
      userId,
      scenarioId,
      snapshotId,
      appliedAt: props.appliedAt,
      createdIncomeIds: [...props.createdIncomeIds],
      createdFixedExpenseIds: [...props.createdFixedExpenseIds],
    });
  }
}

function isIdArray(value: unknown): value is readonly string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === 'string' && item.trim() !== '')
  );
}
