/** Estado de um anexo: so `ready` e gravado; `reading` e `error` existem so no rascunho. */
export type AttachmentStatus = 'reading' | 'ready' | 'error';
