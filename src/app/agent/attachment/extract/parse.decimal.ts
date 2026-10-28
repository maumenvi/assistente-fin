/**
 * Numero de uma celula, em formato brasileiro ou internacional: `1.234,56`, `1234,56`, `1234.56`, `R$ 10,00`, `-5,5`.
 * Devolve `null` para o que nao e numero (datas, textos). Funcao pura.
 */
export function parseDecimal(raw: string): number | null {
  const text = raw.replace(/R\$|\s/g, '');
  if (!/^[-+]?[\d.,]+$/.test(text) || !/\d/.test(text)) return null;
  const sign = text.startsWith('-') ? -1 : 1;
  const body = text.replace(/^[-+]/, '');
  const lastComma = body.lastIndexOf(',');
  const lastDot = body.lastIndexOf('.');
  let normalized: string;
  if (lastComma >= 0 && lastDot >= 0) {
    const decimal = lastComma > lastDot ? ',' : '.';
    const thousand = decimal === ',' ? '.' : ',';
    normalized = body.split(thousand).join('').replace(decimal, '.');
  } else if (lastComma >= 0) {
    if ((body.match(/,/g) ?? []).length > 1) return null;
    normalized = body.replace(',', '.');
  } else if (lastDot >= 0) {
    normalized = /^\d{1,3}(\.\d{3})+$/.test(body) ? body.split('.').join('') : body;
  } else normalized = body;
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null;
  return sign * Number(normalized);
}
