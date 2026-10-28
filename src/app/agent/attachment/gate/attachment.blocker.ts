/** O que impede o envio de anexos agora (pre-checagem das telas e portoes do envio; contracts/consent.md). */
export type AttachmentBlocker = 'local_only' | 'vision' | 'consent' | 'context_too_small' | 'reading';
