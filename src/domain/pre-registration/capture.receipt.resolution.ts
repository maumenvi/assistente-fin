/** Situacao do recibo de captura (spec 027): pendente ou ja resolvido pelo usuario. */
export const CAPTURE_RECEIPT_RESOLUTIONS = ['pending', 'approved', 'discarded'] as const;

/** Um dos valores de `CAPTURE_RECEIPT_RESOLUTIONS`. */
export type CaptureReceiptResolution = (typeof CAPTURE_RECEIPT_RESOLUTIONS)[number];
