/**
 * Limites dos anexos (spec 036, FR-002/FR-005). O orcamento de texto enviado ao modelo NAO e fixo: depende da janela do
 * modelo (`attachmentTextBudget`); aqui fica so o teto.
 */
export const ATTACHMENT_LIMITS = {
  maxFileBytes: 10 * 1024 * 1024,
  maxPerMessage: 5,
  maxMessageBytes: 20 * 1024 * 1024,
  maxRowsPerSheet: 5000,
  maxSheets: 20,
  maxColumns: 50,
  maxImageSidePx: 2000,
  maxNameChars: 200,
  /** Linhas por pagina devolvida por `read_attachment`. */
  pageRows: 200,
  /** Teto de caracteres de texto de anexo enviados ao modelo numa mensagem. */
  maxModelTextChars: 48_000,
  /** Texto corrido maximo lido de um .txt/.pdf. */
  maxTextChars: 200_000,
} as const;
