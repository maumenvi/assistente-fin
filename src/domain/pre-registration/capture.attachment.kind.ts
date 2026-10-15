/** Tipos de anexo de uma captura (spec 022, data-model.md). */
export const CAPTURE_ATTACHMENT_KINDS = ['image', 'notification-text', 'speech-text', 'ocr-text'] as const;

/** Um dos valores de `CAPTURE_ATTACHMENT_KINDS`. */
export type CaptureAttachmentKind = (typeof CAPTURE_ATTACHMENT_KINDS)[number];
