/**
 * Um registro do backup visto pelo dominio (spec 022, US12): so o `kind`, o `id` e campos
 * soltos. O formato exato (e a validacao) e da camada de aplicacao (`backup.record.schema.ts`).
 */
export interface PortableRecord {
  readonly kind: string;
  readonly id?: string | undefined;
  readonly [field: string]: unknown;
}
