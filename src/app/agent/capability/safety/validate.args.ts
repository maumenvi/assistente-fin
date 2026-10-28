export type ArgsVerdict = { readonly status: 'valid' } | { readonly status: 'invalid'; readonly reason: string } | { readonly status: 'unvalidatable' };

type Schema = Record<string, unknown>;

/** Schema com `$ref`/`oneOf`/`anyOf`/`allOf` em qualquer nivel nao e validado aqui (research C4). */
export function isValidatable(schema: unknown): boolean {
  if (schema === null || typeof schema !== 'object') return true;
  if (Array.isArray(schema)) return schema.every(isValidatable);
  const obj = schema as Schema;
  if ('$ref' in obj || 'oneOf' in obj || 'anyOf' in obj || 'allOf' in obj) return false;
  return Object.values(obj).every(isValidatable);
}

function check(schema: Schema, value: unknown, path: string): string | null {
  const type = schema['type'];
  const where = path === '' ? 'argumentos' : path;
  if (Array.isArray(schema['enum']) && !schema['enum'].some((e) => e === value)) return `${where}: valor fora das opcoes permitidas`;
  if (type === 'string') {
    if (typeof value !== 'string') return `${where}: esperava texto`;
    if (typeof schema['minLength'] === 'number' && value.length < schema['minLength']) return `${where}: texto curto demais`;
    if (typeof schema['maxLength'] === 'number' && value.length > schema['maxLength']) return `${where}: texto longo demais`;
  } else if (type === 'number' || type === 'integer') {
    if (typeof value !== 'number' || !Number.isFinite(value)) return `${where}: esperava numero`;
    if (type === 'integer' && !Number.isInteger(value)) return `${where}: esperava numero inteiro`;
    if (typeof schema['minimum'] === 'number' && value < schema['minimum']) return `${where}: menor que o minimo`;
    if (typeof schema['maximum'] === 'number' && value > schema['maximum']) return `${where}: maior que o maximo`;
  } else if (type === 'boolean') {
    if (typeof value !== 'boolean') return `${where}: esperava verdadeiro ou falso`;
  } else if (type === 'array') {
    if (!Array.isArray(value)) return `${where}: esperava lista`;
    if (typeof schema['maxItems'] === 'number' && value.length > schema['maxItems']) return `${where}: itens demais`;
    const items = schema['items'];
    if (items !== null && typeof items === 'object') {
      for (const [i, item] of value.entries()) {
        const problem = check(items as Schema, item, `${path}[${String(i)}]`);
        if (problem !== null) return problem;
      }
    }
  } else if (type === 'object' || (type === undefined && schema['properties'] !== undefined)) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return `${where}: esperava objeto`;
    const obj = value as Record<string, unknown>;
    const props = (schema['properties'] ?? {}) as Record<string, Schema>;
    for (const key of Array.isArray(schema['required']) ? (schema['required'] as string[]) : []) if (!(key in obj)) return `${path === '' ? '' : `${path}.`}${key}: campo obrigatorio`;
    for (const [key, v] of Object.entries(obj)) {
      const child = props[key];
      if (child === undefined) {
        if (schema['additionalProperties'] === false) return `${path === '' ? '' : `${path}.`}${key}: campo nao previsto`;
        continue;
      }
      const problem = check(child, v, `${path === '' ? '' : `${path}.`}${key}`);
      if (problem !== null) return problem;
    }
  }
  return null;
}

/** Valida os argumentos contra o `inputSchema` fixado da ferramenta (subconjunto de JSON Schema). */
export function validateArgs(schema: unknown, args: unknown): ArgsVerdict {
  if (schema === null || typeof schema !== 'object') return { status: 'valid' };
  if (!isValidatable(schema)) return { status: 'unvalidatable' };
  const problem = check(schema as Schema, args ?? {}, '');
  return problem === null ? { status: 'valid' } : { status: 'invalid', reason: problem };
}
