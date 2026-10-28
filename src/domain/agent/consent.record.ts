/** O que o consentimento cobre: as perguntas e consultas (`cloud`, spec 031) ou o conteudo dos anexos (`attachments`, spec 036). */
export type ConsentKind = 'cloud' | 'attachments';

/**
 * Registro de que o usuario autorizou o envio de dados a modelos na nuvem (spec 031, FR-027).
 * `textVersion` identifica o texto mostrado; mudar o texto exige novo consentimento.
 */
export interface ConsentRecord {
  readonly kind: ConsentKind;
  readonly acceptedAt: string;
  readonly textVersion: string;
}
