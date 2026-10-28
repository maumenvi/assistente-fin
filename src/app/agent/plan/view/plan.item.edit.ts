import { formatBrl } from '../../verify/format.brl.ts';
import { parseBrlToCents } from '../../verify/parse.brl.ts';

export interface EditableField {
  readonly name: string;
  readonly label: string;
  readonly kind: 'money' | 'date' | 'text';
  /** Valor inicial como o usuario le (dinheiro em reais pt-BR, data AAAA-MM-DD). */
  readonly value: string;
}

/** Campos que a revisao deixa editar (valor, data, descricao...), na ordem em que aparecem. */
const FIELDS: readonly { name: string; label: string; kind: EditableField['kind'] }[] = [
  { name: 'amountCents', label: 'Valor (R$)', kind: 'money' },
  { name: 'expectedAmountCents', label: 'Valor esperado (R$)', kind: 'money' },
  { name: 'date', label: 'Data (AAAA-MM-DD)', kind: 'date' },
  { name: 'notes', label: 'Descrição', kind: 'text' },
  { name: 'description', label: 'Descrição', kind: 'text' },
  { name: 'source', label: 'Origem', kind: 'text' },
  { name: 'name', label: 'Nome', kind: 'text' },
];

/** So os campos que o item tem; exclusao e transferencia tambem editam valor/data se tiverem. */
export function editableFields(input: Readonly<Record<string, unknown>>): EditableField[] {
  const out: EditableField[] = [];
  for (const field of FIELDS) {
    const raw = input[field.name];
    if (raw === undefined) continue;
    const value = field.kind === 'money' && typeof raw === 'number' ? formatBrl(raw).replace('R$ ', '') : String(raw);
    out.push({ ...field, value });
  }
  return out;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type BuiltEdits = { readonly ok: true; readonly edits: Record<string, string | number> } | { readonly ok: false; readonly errors: readonly string[] };

/** Valida o que o usuario digitou e devolve so os campos que mudaram (valor em centavos). */
export function buildEdits(fields: readonly EditableField[], values: Readonly<Record<string, string>>): BuiltEdits {
  const edits: Record<string, string | number> = {};
  const errors: string[] = [];
  for (const field of fields) {
    const typed = (values[field.name] ?? field.value).trim();
    if (typed === field.value.trim()) continue;
    if (field.kind === 'money') {
      const cents = parseBrlToCents(typed);
      if (cents === null || cents <= 0) errors.push(`${field.label}: valor inválido`);
      else edits[field.name] = cents;
    } else if (field.kind === 'date') {
      if (!DATE.test(typed) || Number.isNaN(new Date(`${typed}T12:00:00Z`).getTime())) errors.push(`${field.label}: use AAAA-MM-DD`);
      else edits[field.name] = typed;
    } else if (typed === '') errors.push(`${field.label}: não pode ficar vazio`);
    else edits[field.name] = typed;
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, edits };
}
