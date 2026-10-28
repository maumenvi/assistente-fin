import { type Attachment } from '../../../../domain/agent/attachment/attachment.ts';
import { type ExtractedSheet } from '../../../../domain/agent/attachment/extracted.sheet.ts';
import { type Fact } from '../../../../domain/agent/fact.ts';
import { countFact } from '../../tools/shared/count.fact.ts';
import { moneyFact } from '../../tools/shared/money.fact.ts';
import { collectCellFacts, ValueFactCollector } from './cell.value.facts.ts';

/** Colunas cujo cabecalho indica dinheiro: a soma vira fato monetario (citavel pelo assistente). */
const MONEY_HEADER = /valor|total|saldo|pre[cç]o|amount|value|debito|débito|credito|crédito/i;

/** Fatos de uma aba, calculados pelo app a partir do arquivo: linhas e soma das colunas de dinheiro (centavos). */
export function sheetFacts(attachment: Pick<Attachment, 'id' | 'name'>, sheet: ExtractedSheet): Fact[] {
  const facts: Fact[] = [countFact(`attachment:${attachment.id}:${sheet.name}:rows`, `linhas de ${attachment.name}`, sheet.totalRows)];
  for (const [col, sum] of Object.entries(sheet.numericTotals)) {
    const header = sheet.header[Number(col)] ?? '';
    if (MONEY_HEADER.test(header)) facts.push(moneyFact(`attachment:${attachment.id}:${sheet.name}:${col}`, `${header} (soma de ${attachment.name})`, Math.round(sum * 100)));
  }
  return facts;
}

/**
 * Fatos locais dos anexos de uma mensagem (spec 036, research R7): entram no ledger da rodada para o assistente poder citar
 * totais e contagens que o app calculou do arquivo, e a verificacao de valores os aceita. Valores lidos de imagem NAO viram fatos.
 */
export function attachmentFacts(attachments: readonly Pick<Attachment, 'id' | 'name' | 'extracted'>[]): Fact[] {
  return attachments.flatMap((a) => {
    const content = a.extracted;
    if (content === null) return [];
    const facts = content.sheets.flatMap((sheet) => sheetFacts(a, sheet));
    facts.push(...valueFacts(a));
    if (content.sheets.length === 0 && content.text !== null) facts.push(countFact(`attachment:${a.id}:lines`, `linhas de ${a.name}`, content.text.split('\n').length));
    return facts.map((f) => ({ ...f, sourceCallId: 'attachment' }));
  });
}

/** Fatos dos valores de linhas de tabela (celula a celula, com o cabecalho da coluna como dica de dinheiro). */
export function rowsValueFacts(prefix: string, header: readonly string[], rows: readonly (readonly string[])[], into = new ValueFactCollector(prefix)): Fact[] {
  for (const row of rows) {
    row.forEach((cell, col) => collectCellFacts(cell, header[col] ?? '', into));
    if (into.full) break;
  }
  return into.result();
}

/** Fatos dos valores de um texto corrido (txt/pdf): a linha inteira e cada pedaco separado por espaco, `;` ou `|`. */
export function textValueFacts(prefix: string, text: string, into = new ValueFactCollector(prefix)): Fact[] {
  for (const line of text.split('\n')) {
    collectCellFacts(line, '', into);
    for (const token of line.split(/[\s;|]+/)) collectCellFacts(token, '', into);
    if (into.full) break;
  }
  return into.result();
}

/**
 * Todo valor legivel do anexo (celulas de planilha/tabela e texto de txt/pdf) vira fato citavel (spec 040, R5/FR-006):
 * o que o arquivo diz nao pode ser mascarado como "(valor nao confirmado)". Valores inventados continuam fora.
 */
export function valueFacts(attachment: Pick<Attachment, 'id' | 'extracted'>): Fact[] {
  const content = attachment.extracted;
  if (content === null) return [];
  const into = new ValueFactCollector(`attachment:${attachment.id}:v`);
  for (const sheet of content.sheets) rowsValueFacts('', sheet.header, sheet.rows, into);
  if (content.text !== null) textValueFacts('', content.text, into);
  return into.result();
}
