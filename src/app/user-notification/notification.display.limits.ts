import { MCP_NOTIFICATION_SOURCE } from './mcp.notification.source.ts';
import { type NotificationDisplayLimit } from './notification.display.limit.ts';

/**
 * Limites de exibicao por origem (spec 013, RF-9a, research R12). Acima do limite a notificacao
 * e salva normalmente, mas nasce ja entregue (sem toast). Origem fora do mapa nao tem limite.
 */
export const NOTIFICATION_DISPLAY_LIMITS: Readonly<Record<string, NotificationDisplayLimit>> = {
  [MCP_NOTIFICATION_SOURCE]: { max: 10, windowMs: 60_000 },
};
