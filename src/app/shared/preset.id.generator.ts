import { type IdGenerator } from './id.generator.port.ts';

/**
 * `IdGenerator` que entrega primeiro um id ja escolhido e depois delega (spec 027): permite gravar
 * o recibo de captura com o id do pre-registro ANTES de cria-lo, na mesma transacao.
 */
export class PresetIdGenerator implements IdGenerator {
  private preset: string | null;
  private readonly fallback: IdGenerator;

  public constructor(preset: string, fallback: IdGenerator) {
    this.preset = preset;
    this.fallback = fallback;
  }

  public next(): string {
    if (this.preset === null) return this.fallback.next();
    const id = this.preset;
    this.preset = null;
    return id;
  }
}
