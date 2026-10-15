import { type Income } from '../../domain/income/income.entity.ts';
import { type WithCategory } from '../category/with.category.ts';

/**
 * Um `Income` acompanhado dos dados da categoria (`WithCategory`, ja existente) e dos meses
 * ja lancados no Extrato (spec 012, RF-3/RF-6/RF-10, Q4) - usado pela tela "Ganhos" para
 * decidir, por linha e por mes selecionado (`MonthYearPicker`), se mostra o botao de
 * lancamento ou o estado "Lançado".
 */
export interface IncomeWithLaunchStatus extends WithCategory<Income> {
  /** Meses (`"YYYY-MM"`) que ja tem uma `Transaction` vinculada a este `Income` (Q4). */
  readonly launchedMonths: readonly string[];
}
