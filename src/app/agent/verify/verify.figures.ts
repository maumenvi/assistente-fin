import { extractFigures } from './extract.figures.ts';
import { type FactLedger } from './fact.ledger.ts';
import { type Figure } from './figure.ts';

/** Resultado da conferencia de uma resposta. */
export interface FigureVerification {
  readonly ok: boolean;
  /** Figuras da resposta que nao estao entre os fatos. */
  readonly mismatches: readonly Figure[];
}

/** Confere cada figura do texto contra o livro-razao de fatos (spec 031, FR-007). */
export function verifyFigures(text: string, ledger: FactLedger): FigureVerification {
  const mismatches = extractFigures(text).filter((figure) => !ledger.has(figure.kind, figure.normalized));
  return { ok: mismatches.length === 0, mismatches };
}
