import { type AiBlockIssue } from '../errors/ai.block.invalid.error.ts';
import { blockMarker } from '../format/block.marker.ts';

/** Quantos problemas a mensagem lista (o resto vira "e mais N"). */
const MAX_LISTED = 12;

function describe(issue: AiBlockIssue): string {
  const where = issue.opIndex < 0 ? 'No bloco' : `Item ${issue.opIndex + 1}`;
  const field = issue.path === '' ? '' : ` (${issue.path})`;
  return `- ${where}${field}: ${issue.message}`;
}

/**
 * Texto para o usuario colar de volta no chat da IA e pedir o bloco corrigido (spec 029, FR-004,
 * tela 8). Lista so os problemas e a lembranca do formato: nunca valores nem descricoes do usuario.
 */
export function formatImportErrors(issues: readonly AiBlockIssue[]): string {
  const listed = issues.slice(0, MAX_LISTED).map(describe);
  const extra = issues.length > MAX_LISTED ? [`- e mais ${issues.length - MAX_LISTED} problema(s)`] : [];
  return [
    `O bloco que voce enviou tem ${issues.length} problema(s) e nada foi salvo:`,
    ...listed,
    ...extra,
    '',
    `Corrija e devolva um unico bloco de codigo, sem texto dentro, comecando pela linha ${blockMarker()}, com os ids dos dados que enviei e um batchId novo.`,
  ].join('\n');
}
