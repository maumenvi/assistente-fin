/** Tipos de anexo aceitos no chat (spec 036): imagem e quatro formatos de arquivo. */
export const ATTACHMENT_KINDS = ['image', 'text', 'csv', 'xlsx', 'pdf'] as const;

/** Tipo de um anexo. */
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number];
