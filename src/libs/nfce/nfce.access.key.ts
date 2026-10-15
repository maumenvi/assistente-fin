/** Codigo IBGE da UF -> sigla (primeiros 2 digitos da chave de acesso). */
const UF_BY_CODE: Record<string, string> = {
  '11': 'RO', '12': 'AC', '13': 'AM', '14': 'RR', '15': 'PA', '16': 'AP', '17': 'TO',
  '21': 'MA', '22': 'PI', '23': 'CE', '24': 'RN', '25': 'PB', '26': 'PE', '27': 'AL', '28': 'SE', '29': 'BA',
  '31': 'MG', '32': 'ES', '33': 'RJ', '35': 'SP',
  '41': 'PR', '42': 'SC', '43': 'RS',
  '50': 'MS', '51': 'MT', '52': 'GO', '53': 'DF',
};

/** Partes da chave de acesso de 44 digitos de uma NF-e/NFC-e. */
export interface NfceAccessKey {
  readonly key: string;
  readonly uf: string;
  readonly year: number;
  readonly month: number;
  readonly cnpj: string;
  readonly model: string;
  readonly series: number;
  readonly number: number;
}

/** Digito verificador (modulo 11, pesos 2..9 da direita para a esquerda). */
function checkDigit(first43: string): string {
  let total = 0;
  for (let i = 0; i < first43.length; i += 1) {
    const weight = 2 + (i % 8);
    total += Number(first43[first43.length - 1 - i]) * weight;
  }
  const rest = total % 11;
  return rest < 2 ? '0' : String(11 - rest);
}

/**
 * Decodifica a chave de acesso (spec 022, T088): UF, ano/mes de emissao, CNPJ do emitente,
 * modelo, serie e numero. `null` se nao tiver 44 digitos, UF desconhecida ou DV errado.
 */
export function decodeNfceAccessKey(raw: string): NfceAccessKey | null {
  const key = raw.replace(/\D/g, '');
  if (key.length !== 44) return null;
  const uf = UF_BY_CODE[key.slice(0, 2)];
  if (uf === undefined) return null;
  if (checkDigit(key.slice(0, 43)) !== key[43]) return null;
  const month = Number(key.slice(4, 6));
  if (month < 1 || month > 12) return null;
  return {
    key,
    uf,
    year: 2000 + Number(key.slice(2, 4)),
    month,
    cnpj: key.slice(6, 20),
    model: key.slice(20, 22),
    series: Number(key.slice(22, 25)),
    number: Number(key.slice(25, 34)),
  };
}
