import { InvalidMonthError } from './invalid.month.error.ts';

/** Ano minimo aceito - antes disso nao ha sentido em competencia financeira aqui. */
const MIN_YEAR = 1970;

/** Dados para criar um `Month`. */
export interface MonthProps {
  readonly year: number;
  readonly month: number;
}

/**
 * Mes de competencia (ano + mes), usado em previsoes e limites (spec 001, RF-4, RF-7).
 *
 * Imutavel, comparavel e incrementavel - `next()`/`previous()` cruzam o ano de virada sem o
 * chamador precisar pensar em "mes 13".
 */
export class Month {
  public readonly year: number;
  public readonly month: number;

  private constructor(year: number, month: number) {
    this.year = year;
    this.month = month;
  }

  /** Cria a partir de `{ year, month }`. Lanca `InvalidMonthError` se fora dos limites. */
  public static create(props: MonthProps): Month {
    if (!Number.isInteger(props.year) || props.year < MIN_YEAR) {
      throw new InvalidMonthError(`year deve ser inteiro >= ${MIN_YEAR}`);
    }
    if (!Number.isInteger(props.month) || props.month < 1 || props.month > 12) {
      throw new InvalidMonthError('month deve ser inteiro entre 1 e 12');
    }
    return new Month(props.year, props.month);
  }

  /** Extrai o mes de competencia de uma `Date` (usa ano/mes UTC). */
  public static fromDate(date: Date): Month {
    return Month.create({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 });
  }

  public equals(other: Month): boolean {
    return this.year === other.year && this.month === other.month;
  }

  /** -1 se anterior, 0 se igual, 1 se posterior. */
  public compare(other: Month): -1 | 0 | 1 {
    if (this.year !== other.year) return this.year < other.year ? -1 : 1;
    if (this.month !== other.month) return this.month < other.month ? -1 : 1;
    return 0;
  }

  /** Proximo mes (dezembro -> janeiro do ano seguinte). */
  public next(): Month {
    return this.month === 12
      ? Month.create({ year: this.year + 1, month: 1 })
      : Month.create({ year: this.year, month: this.month + 1 });
  }

  /**
   * Mes anterior (janeiro -> dezembro do ano anterior). Lanca `InvalidMonthError` se cruzar
   * o limite minimo (janeiro de `MIN_YEAR`).
   */
  public previous(): Month {
    return this.month === 1
      ? Month.create({ year: this.year - 1, month: 12 })
      : Month.create({ year: this.year, month: this.month - 1 });
  }

  /** Representacao `AAAA-MM`, ex: `2026-01`. */
  public toString(): string {
    return `${this.year.toString().padStart(4, '0')}-${this.month.toString().padStart(2, '0')}`;
  }
}
