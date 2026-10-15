/**
 * Captura nova vinda do celular num lote de push (spec 013, RF-12): so o que a notificacao
 * mostra. `null` quando o pre-registro nao trouxe o campo.
 */
export interface NewCapture {
  readonly amountCents: number | null;
  readonly description: string | null;
}
