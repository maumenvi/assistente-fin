import { ReportDataMismatchError } from '../../../../domain/agent/errors/report.data.mismatch.error.ts';
import { type Fact } from '../../../../domain/agent/fact.ts';
import { type ReportSpec } from '../../../../domain/agent/report/report.spec.ts';
import { FactLedger } from '../../verify/fact.ledger.ts';
import { verifyFigures } from '../../verify/verify.figures.ts';
import { reportPlainText } from './report.plain.text.ts';

/**
 * Todo numero do relatorio (texto, tabelas e graficos) precisa estar entre os fatos que as consultas desta execucao devolveram
 * (spec 040, FR-017); o que a pessoa escreveu no pedido tambem vale. Numero fora do ledger => `ReportDataMismatchError` listando os valores; nada e gravado.
 */
export function validateReportFigures(spec: ReportSpec, facts: readonly Fact[], userText = ''): void {
  const ledger = new FactLedger(facts);
  ledger.addUserText(userText);
  const verification = verifyFigures(reportPlainText(spec), ledger);
  if (!verification.ok) throw new ReportDataMismatchError([...new Set(verification.mismatches.map((m) => m.raw))]);
}
