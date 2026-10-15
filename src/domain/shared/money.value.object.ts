import { type Currency, DEFAULT_CURRENCY } from './currency.ts';
import { InvalidMoneyAmountError } from './invalid.money.amount.error.ts';
import { CurrencyMismatchError } from './currency.mismatch.error.ts';

/**
 * Valor monetario imutavel.
 *
 * Guarda o montante como centavos inteiros (`number`) para evitar erros de ponto
 * flutuante em somatorios financeiros. Toda operacao retorna uma nova instancia
 * (funcao pura, rule 8) e nunca muta a atual.
 */
export class Money {
  /** Centavos inteiros. Pode ser negativo (saldo devedor, ajuste). */
  public readonly cents: number;
  public readonly currency: Currency;

  private constructor(cents: number, currency: Currency) {
    this.cents = cents;
    this.currency = currency;
  }

  /** Cria a partir de centavos inteiros. Rejeita valores nao finitos ou fracionados. */
  public static fromCents(cents: number, currency: Currency = DEFAULT_CURRENCY): Money {
    if (!Number.isSafeInteger(cents)) {
      throw new InvalidMoneyAmountError(cents);
    }
    return new Money(cents, currency);
  }

  /**
   * Cria a partir de um valor decimal na unidade principal (ex: `10.5` reais => 1050
   * centavos). Arredonda para o centavo mais proximo (half away from zero).
   */
  public static fromDecimal(amount: number, currency: Currency = DEFAULT_CURRENCY): Money {
    if (!Number.isFinite(amount)) {
      throw new InvalidMoneyAmountError(amount);
    }
    const cents = Math.round(amount * 100);
    // `Math.round(-0.5)` => `-0`; normaliza para `0`.
    return Money.fromCents(cents === 0 ? 0 : cents, currency);
  }

  /** Valor zero na moeda informada. */
  public static zero(currency: Currency = DEFAULT_CURRENCY): Money {
    return new Money(0, currency);
  }

  public add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.fromCents(this.cents + other.cents, this.currency);
  }

  public subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.fromCents(this.cents - other.cents, this.currency);
  }

  /**
   * Multiplica por um fator (ex: quantidade de parcelas ou percentual). Arredonda o
   * resultado para o centavo mais proximo.
   */
  public multiply(factor: number): Money {
    if (!Number.isFinite(factor)) {
      throw new InvalidMoneyAmountError(factor);
    }
    return Money.fromCents(Math.round(this.cents * factor), this.currency);
  }

  /** -1 se menor, 0 se igual, 1 se maior. Exige a mesma moeda. */
  public compare(other: Money): -1 | 0 | 1 {
    this.assertSameCurrency(other);
    if (this.cents < other.cents) return -1;
    if (this.cents > other.cents) return 1;
    return 0;
  }

  public equals(other: Money): boolean {
    return this.currency === other.currency && this.cents === other.cents;
  }

  public isNegative(): boolean {
    return this.cents < 0;
  }

  public isZero(): boolean {
    return this.cents === 0;
  }

  public isPositive(): boolean {
    return this.cents > 0;
  }

  /** Formata para exibicao (ex: `R$ 1.234,56` para BRL em pt-BR). */
  public format(locale = 'pt-BR'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: this.currency,
    }).format(this.cents / 100);
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new CurrencyMismatchError(this.currency, other.currency);
    }
  }
}
