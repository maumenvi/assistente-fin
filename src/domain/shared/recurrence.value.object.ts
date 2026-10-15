import { RECURRENCE_FREQUENCIES, type RecurrenceFrequency } from './recurrence.frequency.ts';
import { InvalidRecurrenceError } from './invalid.recurrence.error.ts';

/** Dados para criar uma `Recurrence`. `everyN` default 1; `endDate` obrigatoria quando repete. */
export interface RecurrenceProps {
  readonly frequency: RecurrenceFrequency;
  readonly everyN?: number | undefined;
  readonly endDate?: Date | null | undefined;
}

/**
 * Recorrencia de um ganho, transacao manual ou simulacao (spec 003, RF-16).
 *
 * Imutavel. Modelo: `frequency` (7 presets) + `everyN` ("a cada N periodos", inteiro >= 1,
 * default 1) + `endDate` (data final da serie). `frequency === 'nao-repete'` significa
 * evento unico e exige `endDate` ausente; qualquer outra frequencia exige `endDate`.
 *
 * A `Recurrence` NAO valida `endDate` contra a data inicial (nao a conhece) - o teto por
 * frequencia (`recurrence.reach.ts`, RF-18) e checado pela entidade dona, que tem a ancora.
 *
 * `everyN > 1` so aparece em dados migrados (ex.: quinzenal = `semanal` a cada 2); o
 * cadastro de novos lancamentos usa sempre `everyN: 1` (spec 003, RF-22).
 */
export class Recurrence {
  public readonly frequency: RecurrenceFrequency;
  public readonly everyN: number;
  public readonly endDate: Date | null;

  private constructor(frequency: RecurrenceFrequency, everyN: number, endDate: Date | null) {
    this.frequency = frequency;
    this.everyN = everyN;
    this.endDate = endDate;
  }

  /** Cria a partir de `{ frequency, everyN?, endDate? }`. Lanca `InvalidRecurrenceError` se invalido. */
  public static create(props: RecurrenceProps): Recurrence {
    const everyN = props.everyN ?? 1;
    const endDate = props.endDate ?? null;

    if (!RECURRENCE_FREQUENCIES.includes(props.frequency)) {
      throw new InvalidRecurrenceError(`frequency desconhecida: ${String(props.frequency)}`);
    }
    if (!Number.isInteger(everyN) || everyN < 1) {
      throw new InvalidRecurrenceError('everyN deve ser um inteiro >= 1');
    }

    if (props.frequency === 'nao-repete') {
      if (endDate !== null) {
        throw new InvalidRecurrenceError('"nao-repete" nao pode ter data final');
      }
      return new Recurrence('nao-repete', everyN, null);
    }

    if (!(endDate instanceof Date) || Number.isNaN(endDate.getTime())) {
      throw new InvalidRecurrenceError('recorrencia com frequencia precisa de data final valida');
    }
    return new Recurrence(props.frequency, everyN, endDate);
  }

  /** Atalho para `Recurrence.create({ frequency: 'nao-repete' })` - evento unico. */
  public static none(): Recurrence {
    return Recurrence.create({ frequency: 'nao-repete' });
  }

  /** `true` quando a recorrencia de fato repete (frequency !== 'nao-repete'). */
  public repeats(): boolean {
    return this.frequency !== 'nao-repete';
  }

  /** Devolve a mesma recorrencia com outra data final (mantem frequencia e `everyN`). */
  public withEndDate(endDate: Date): Recurrence {
    return Recurrence.create({ frequency: this.frequency, everyN: this.everyN, endDate });
  }

  public equals(other: Recurrence): boolean {
    return (
      this.frequency === other.frequency &&
      this.everyN === other.everyN &&
      (this.endDate?.getTime() ?? null) === (other.endDate?.getTime() ?? null)
    );
  }
}
