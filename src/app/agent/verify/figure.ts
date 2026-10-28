/** Figura (valor, percentual, data ou quantidade) encontrada num texto de resposta. */
export interface Figure {
  readonly kind: 'money' | 'percent' | 'date' | 'count';
  /** O trecho original, como escrito. */
  readonly raw: string;
  /** Posicao no texto (`start` inclusive, `end` exclusivo). */
  readonly start: number;
  readonly end: number;
  /** Forma canonica para comparar: centavos, numero, `AAAA-MM-DD`/`MM-DD` ou quantidade. */
  readonly normalized: string;
}
