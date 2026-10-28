import { type SyncEntity } from './sync.entity.ts';

/**
 * Entidades que se resolvem por "a ultima escrita vence" em vez de abrir conflito para o usuario
 * (spec 032, research P1): uma preferencia disputada entre os dois aparelhos fica com a versao
 * mais recente e a perdedora vira um aviso discreto (`PreferenceOverwrite`), nao uma pendencia.
 */
export const LAST_WRITE_WINS_SYNC_ENTITIES: readonly SyncEntity[] = ['preference', 'categorizationRule'];
