import { InvalidPhoneError } from './invalid.phone.error.ts';

/** DDDs brasileiros vao de 11 a 99 (nao ha DDD comecando em 0). */
const DDD_PATTERN = /^[1-9][0-9]$/;

/**
 * Telefone brasileiro validado e normalizado para E.164 (spec 001, RF-23).
 *
 * Aceita DDD + numero com ou sem `+55`/mascara; celular tem 9 digitos e comeca com `9`
 * (padrao desde a migracao de 2016), fixo tem 8. Normaliza sempre para `+55DDDNUMERO` -
 * formato que o `SmsSender` (RF-25) espera e que serve de chave de unicidade
 * (`User.phone` e `@unique` no banco).
 */
export class Phone {
  /** Numero em E.164, ex: `+5511987654321`. */
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /** Cria a partir de uma string qualquer. Lanca `InvalidPhoneError` se nao for um numero BR valido. */
  public static create(raw: string): Phone {
    let digits = raw.replace(/\D/g, '');
    if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
      digits = digits.slice(2);
    }
    if (digits.length !== 10 && digits.length !== 11) {
      throw new InvalidPhoneError();
    }

    const ddd = digits.slice(0, 2);
    const number = digits.slice(2);
    if (!DDD_PATTERN.test(ddd)) {
      throw new InvalidPhoneError();
    }
    if (number.length === 9 && number[0] !== '9') {
      throw new InvalidPhoneError();
    }

    return new Phone(`+55${ddd}${number}`);
  }

  public equals(other: Phone): boolean {
    return this.value === other.value;
  }

  /** Representacao com mascara: `(11) 98765-4321` ou `(11) 3265-4321`. */
  public format(): string {
    const ddd = this.value.slice(3, 5);
    const number = this.value.slice(5);
    const splitAt = number.length - 4;
    return `(${ddd}) ${number.slice(0, splitAt)}-${number.slice(splitAt)}`;
  }
}
