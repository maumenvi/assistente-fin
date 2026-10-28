import { AttachmentUnreadableError } from '../../../../domain/agent/attachment/errors/attachment.unreadable.error.ts';
import { type Fact } from '../../../../domain/agent/fact.ts';
import { decodeTextBytes } from '../../attachment/extract/decode.text.bytes.ts';
import { extractCsv } from '../../attachment/extract/extract.csv.ts';
import { extractPdf } from '../../attachment/extract/extract.pdf.ts';
import { extractXlsx } from '../../attachment/extract/extract.xlsx.ts';
import { rowsValueFacts, textValueFacts } from '../../attachment/model/attachment.facts.ts';
import { ValueFactCollector } from '../../attachment/model/cell.value.facts.ts';
import { rowLine } from '../../attachment/model/attachment.summary.ts';
import { sanitizeAttachmentText } from '../../attachment/model/sanitize.attachment.text.ts';
import { countFact } from '../shared/count.fact.ts';
import { type PdfTextPort } from '../../attachment/ports/pdf.text.port.ts';

export interface FileText {
  readonly text: string;
  /** Todo valor legivel do arquivo (R5): o assistente pode cita-los sem virar "valor nao confirmado". */
  readonly facts: readonly Fact[];
}

/**
 * Converte os bytes de um arquivo em texto para o modelo (spec 040, FR-009): csv/xlsx/pdf pelos mesmos extratores dos anexos,
 * o resto como texto puro. Binario desconhecido => `AttachmentUnreadableError`. Cada valor legivel vira fato com o prefixo `factPrefix`.
 */
export async function fileBytesToText(name: string, bytes: Uint8Array, factPrefix: string, pdf: PdfTextPort | undefined): Promise<FileText> {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? '';
  const collector = new ValueFactCollector(factPrefix);
  if (ext === 'csv' || ext === 'xlsx') {
    const content = ext === 'csv' ? extractCsv(bytes) : extractXlsx(bytes);
    const counts: Fact[] = [];
    const parts = content.sheets.map((sheet) => {
      rowsValueFacts('', sheet.header, sheet.rows, collector);
      counts.push(countFact(`${factPrefix}:rows:${sheet.name}`, `linhas de ${name} (${sheet.name})`, sheet.totalRows));
      return [`Aba "${sheet.name}" (${sheet.totalRows} linhas)`, rowLine(sheet.header), ...sheet.rows.map(rowLine)].join('\n');
    });
    return { text: parts.join('\n\n'), facts: [...collector.result(), ...counts] };
  }
  if (ext === 'pdf') {
    if (pdf === undefined) throw new AttachmentUnreadableError('corrupt');
    const content = await extractPdf(bytes, pdf);
    const text = sanitizeAttachmentText(content.text ?? '');
    textValueFacts('', text, collector);
    return { text, facts: [...collector.result(), countFact(`${factPrefix}:lines`, `linhas de ${name}`, text.split('\n').length)] };
  }
  // qualquer outro arquivo e lido como texto, desde que nao seja binario
  if (bytes.subarray(0, 4096).includes(0)) throw new AttachmentUnreadableError('corrupt');
  const text = sanitizeAttachmentText(decodeTextBytes(bytes));
  textValueFacts('', text, collector);
  return { text, facts: [...collector.result(), countFact(`${factPrefix}:lines`, `linhas de ${name}`, text.split('\n').length)] };
}
