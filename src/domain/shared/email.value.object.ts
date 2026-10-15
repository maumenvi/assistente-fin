import { InvalidEmailError } from './invalid.email.error.ts';

/** Formato basico `local@dominio.tld` - nao tenta cobrir todo o RFC 5322, so o essencial. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * E-mail validado e normalizado (spec 001, RF-23).
 *
 * Guarda sempre em minusculas e sem espacos nas pontas, pra `Email` funcionar como chave de
 * unicidade estavel (`User.email` e `@unique` no banco).
 */
export class Email {
  /** Endereco normalizado (minusculas, sem espacos nas pontas). */
  public readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  /** Cria a partir de uma string qualquer. Lanca `InvalidEmailError` se o formato for invalido. */
  public static create(raw: string): Email {
    const normalized = raw.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(normalized)) {
      throw new InvalidEmailError();
    }
    return new Email(normalized);
  }

  public equals(other: Email): boolean {
    return this.value === other.value;
  }
}
