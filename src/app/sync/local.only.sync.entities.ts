import { type SyncEntity } from './sync.entity.ts';

/**
 * Entidades do protocolo que NAO sincronizam mais (spec 027, FR-011, research R9): pre-registros
 * e seus anexos ficam so no celular. Continuam em `SYNC_ENTITIES` porque celulares antigos ainda
 * podem envia-las - o hub aceita e descarta.
 */
export const LOCAL_ONLY_SYNC_ENTITIES: readonly SyncEntity[] = ['preRegistration', 'captureAttachment'];
