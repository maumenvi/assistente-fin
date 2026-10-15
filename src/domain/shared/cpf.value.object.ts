import { InvalidCpfError } from './invalid.cpf.error.ts';

/** Quantidade de digitos de um CPF. */
const CPF_LENGTH = 11;

/**
 * CPF (Cadastro de Pessoa Fisica) validado e normalizado.
 *
 * Identifica o usuario no sistema multiusuario (spec 001, RF-15). Guarda apenas os 11
 * digitos, sem mascara; `format()` devolve a representacao com pontuacao.
 */
export class Cpf {
  /** Os 11 digitos, sem pontuacao. */
  public readonly digits: string;

  private constructor(digits: string) {
    this.digits = digits;
  }

  /**
   * Cria a partir de uma string com ou sem mascara (`"529.982.247-25"` ou
   * `"52998224725"`). Lanca `InvalidCpfError` se nao for um CPF valido.
   */
  public static create(raw: string): Cpf {
    const digits = raw.replace(/\D/g, '');

    if (digits.length !== CPF_LENGTH || /^(\d)\1{10}$/.test(digits)) {
      throw new InvalidCpfError();
    }
    if (
      Cpf.checkDigit(digits, 9) !== Number(digits[9]) ||
      Cpf.checkDigit(digits, 10) !== Number(digits[10])
    ) {
      throw new InvalidCpfError();
    }
    return new Cpf(digits);
  }

  public equals(other: Cpf): boolean {
    return this.digits === other.digits;
  }

  /** Representacao com mascara: `529.982.247-25`. */
  public format(): string {
    return this.digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }

  /**
   * Calcula o digito verificador da posicao `position` (9 => primeiro DV, 10 => segundo)
   * pelo algoritmo modulo 11 da Receita Federal.
   */
  private static checkDigit(digits: string, position: number): number {
    let sum = 0;
    let weight = position + 1;
    for (let index = 0; index < position; index += 1) {
      sum += Number(digits[index]) * weight;
      weight -= 1;
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  }
}
