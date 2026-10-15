import { type VerificationCodeGenerator } from '../../src/app/shared/verification.code.generator.port.ts';

/** `VerificationCodeGenerator` deterministico para testes: sempre devolve o mesmo codigo. */
export class FixedCodeGenerator implements VerificationCodeGenerator {
  private readonly code: string;

  public constructor(code = '123456') {
    this.code = code;
  }

  public next(): string {
    return this.code;
  }
}
