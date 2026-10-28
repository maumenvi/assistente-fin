import { type Fact } from '../../../../domain/agent/fact.ts';
import { type Figure } from '../../verify/figure.ts';

/** Quantos valores permitidos entram na nota de correcao (mantem o prompt curto). */
const MAX_ALLOWED = 40;

/**
 * Nota enviada ao modelo quando a resposta trouxe valores que nenhuma ferramenta confirmou:
 * lista o que foi citado sem base e os UNICOS valores permitidos (spec 031, D10).
 */
export function buildCorrectionNote(ledger: readonly Fact[], mismatches: readonly Figure[]): string {
  const cited = mismatches.map((figure) => `"${figure.raw}"`).join(', ');
  const allowed = ledger
    .slice(0, MAX_ALLOWED)
    .map((fact) => `${fact.display} (${fact.label})`)
    .join('; ');
  const allowedText = allowed === '' ? 'nenhum valor foi apurado ainda' : allowed;
  return `Correção: sua resposta citou ${cited}, que não aparece nos dados consultados. Refaça a resposta usando apenas estes valores: ${allowedText}. Se o dado não existe, diga que não encontrou.`;
}
