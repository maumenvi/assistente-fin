const UNITS: Record<string, number> = {
  zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
};
const TEENS: Record<string, number> = {
  dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
};
const TENS: Record<string, number> = {
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90,
};
const HUNDREDS: Record<string, number> = {
  cem: 100, cento: 100, duzentos: 200, duzentas: 200, trezentos: 300, trezentas: 300, quatrocentos: 400, quatrocentas: 400,
  quinhentos: 500, quinhentas: 500, seiscentos: 600, seiscentas: 600, setecentos: 700, setecentas: 700,
  oitocentos: 800, oitocentas: 800, novecentos: 900, novecentas: 900,
};

function normalize(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Nivel do ultimo termo: 3 centena, 2 dezena, 1 unidade/dez-a-dezenove, 0 nada ainda. */
type Level = 0 | 1 | 2 | 3;

/**
 * Le numeros escritos por extenso em portugues (spec 022, T097): "cento e quarenta e cinco" ->
 * 145, "dois mil e quinhentos" -> 2500. Quando um termo nao cabe no numero corrente (uma dezena
 * depois de uma unidade: "...e cinco e trinta"), comeca outro numero - por isso devolve lista.
 */
export function parseNumberWords(text: string): number[] {
  const numbers: number[] = [];
  let thousands = 0;
  let current = 0;
  let level: Level = 0;
  let active = false;

  const flush = () => {
    if (active) numbers.push(thousands + current);
    thousands = 0;
    current = 0;
    level = 0;
    active = false;
  };

  for (const word of normalize(text)) {
    if (word === 'e') continue;
    if (word === 'mil') {
      thousands += (active ? current || 1 : 1) * 1000;
      current = 0;
      level = 0;
      active = true;
      continue;
    }
    let value: number | undefined;
    let wordLevel: Level = 0;
    if (word in HUNDREDS) {
      value = HUNDREDS[word];
      wordLevel = 3;
    } else if (word in TENS) {
      value = TENS[word];
      wordLevel = 2;
    } else if (word in TEENS) {
      value = TEENS[word];
      wordLevel = 1;
    } else if (word in UNITS) {
      value = UNITS[word];
      wordLevel = 1;
    }
    if (value === undefined) {
      flush();
      continue;
    }
    if (active && level !== 0 && wordLevel >= level) flush();
    current += value;
    level = wordLevel;
    active = true;
  }
  flush();
  return numbers;
}

/**
 * Valor falado em centavos (spec 022, T097): "sessenta e cinco reais" -> 6500, "vinte reais e
 * cinquenta centavos" -> 2050, "cento e quarenta e cinco e trinta" -> 14530 (o segundo numero
 * vira os centavos). `null` sem numero reconhecivel.
 */
export function parseSpokenAmount(text: string): number | null {
  const numbers = parseNumberWords(text);
  const reais = numbers[0];
  if (reais === undefined) return null;
  const cents = numbers[1];
  return reais * 100 + (cents !== undefined && cents < 100 ? cents : 0);
}
