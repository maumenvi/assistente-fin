/**
 * Interpreta os argumentos de uma chamada de ferramenta, com reparo tolerante dos defeitos comuns
 * de modelos menores: texto vazio (vira `{}`), cercas ```json, virgula final e aspas simples
 * obvias. Lanca `SyntaxError` quando nao ha reparo possivel.
 */
export function repairToolArgs(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed === '') return {};
  try {
    return JSON.parse(trimmed);
  } catch {
    // tenta reparar abaixo
  }
  let fixed = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  fixed = fixed.replace(/,\s*([}\]])/g, '$1');
  if (!fixed.includes('"') && fixed.includes("'")) fixed = fixed.replace(/'/g, '"');
  return JSON.parse(fixed);
}
