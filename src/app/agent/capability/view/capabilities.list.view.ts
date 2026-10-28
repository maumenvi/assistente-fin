import { type Capability } from '../../../../domain/capability/capability.ts';
import { type CapabilityRequest } from '../../../../domain/capability/capability.request.ts';
import { type CapabilityStatus } from '../../../../domain/capability/capability.status.ts';
import { type Permission } from '../../../../domain/capability/permission.ts';
import { TRUST_BADGE_TEXT, type TrustBadge } from '../../../../domain/capability/trust.badge.ts';
import { parseHttpUrl } from '../../../../domain/capability/url.host.ts';

export const EMPTY_CAPABILITIES_TEXT = 'Nenhuma capacidade conectada. O assistente pede a sua aprovação antes de conectar qualquer coisa.';
export const CAPABILITIES_INTRO = 'O assistente só usa o que você aprovou. Cada uma pode ser pausada ou revogada a qualquer momento; ao revogar, as credenciais são apagadas na hora.';

export type CapabilityTone = 'ok' | 'warn' | 'danger' | 'neutral';

export interface CapabilityRowView {
  readonly id: string;
  readonly title: string;
  readonly badge: { readonly id: TrustBadge; readonly text: string; readonly tone: CapabilityTone };
  readonly kindText: string;
  readonly origin: string;
  readonly state: CapabilityStatus;
  readonly stateText: string;
  readonly stateTone: CapabilityTone;
  readonly detail: string;
  readonly permissions: readonly string[];
  readonly approvedText: string;
  readonly lastUsedText: string;
  /** Pedido de reaprovacao pendente (so em `needs_review`): o botao "Revisar mudancas" abre este cartao. */
  readonly reviewRequestId: string | null;
  readonly actions: { readonly pause: boolean; readonly resume: boolean; readonly history: boolean; readonly revoke: boolean; readonly review: boolean };
}

const STATE_TEXT: Readonly<Record<CapabilityStatus, string>> = { active: 'Ativa', paused: 'Pausada', needs_review: 'Mudou — precisa de nova aprovação', revoked: 'Revogada' };
const STATE_TONE: Readonly<Record<CapabilityStatus, CapabilityTone>> = { active: 'ok', paused: 'neutral', needs_review: 'danger', revoked: 'neutral' };
const BADGE_TONE: Readonly<Record<TrustBadge, CapabilityTone>> = { curated: 'ok', official_registry: 'ok', unverified: 'warn' };
const PERMISSION_TEXT: Readonly<Record<Permission, string>> = {
  network: 'internet',
  sends_user_text: 'recebe textos que você escreveu',
  sends_financial_values: 'recebe valores digitados por você',
  needs_credential: 'usa uma chave de acesso',
};

const two = (n: number): string => String(n).padStart(2, '0');
const dayMonth = (iso: string): string => `${two(new Date(iso).getDate())}/${two(new Date(iso).getMonth() + 1)}`;

/** "agora há pouco", "há 2 min", "há 3 h" ou a data (dd/mm). */
export function relativeTime(iso: string, now: Date): string {
  const minutes = Math.floor((now.getTime() - Date.parse(iso)) / 60_000);
  if (minutes < 1) return 'agora há pouco';
  if (minutes < 60) return `há ${String(minutes)} min`;
  if (minutes < 24 * 60) return `há ${String(Math.floor(minutes / 60))} h`;
  return `em ${dayMonth(iso)}`;
}

function detailOf(capability: Capability, review: CapabilityRequest | undefined): string {
  if (capability.status === 'needs_review') {
    const diff = review?.diff;
    const parts = diff === null || diff === undefined ? [] : [diff.changed.length > 0 ? `${String(diff.changed.length)} ferramenta(s) com descrição ou campos alterados` : '', diff.added.length > 0 ? `${String(diff.added.length)} nova(s)` : '', diff.removed.length > 0 ? `${String(diff.removed.length)} removida(s)` : ''].filter((p) => p !== '');
    return `${parts.length > 0 ? `${parts.join(', ')}. ` : ''}Enquanto não aprovar de novo, o assistente não usa esta capacidade.`;
  }
  return capability.kind === 'skill' ? 'Só orienta o assistente; não executa código.' : '';
}

/** Linhas da tela "Capacidades conectadas" (canvas D16/M16): estado, selo, permissoes, datas e acoes habilitadas. Revogadas ficam fora. */
export function buildCapabilitiesList(capabilities: readonly Capability[], pending: readonly CapabilityRequest[], now: Date): CapabilityRowView[] {
  return [...capabilities]
    .filter((c) => c.status !== 'revoked')
    .sort((a, b) => (a.status === 'needs_review' ? 0 : 1) - (b.status === 'needs_review' ? 0 : 1) || Date.parse(b.approvedAt) - Date.parse(a.approvedAt))
    .map((c) => {
      const review = pending.find((r) => r.replacesCapabilityId === c.id);
      const host = c.endpoint === undefined ? null : (parseHttpUrl(c.endpoint.url)?.host ?? null);
      return {
        id: c.id,
        title: c.name,
        badge: { id: c.badge, text: TRUST_BADGE_TEXT[c.badge], tone: BADGE_TONE[c.badge] },
        kindText: c.kind === 'skill' ? 'Skill de instruções' : 'MCP remoto',
        origin: host ?? c.publisher,
        state: c.status,
        stateText: STATE_TEXT[c.status],
        stateTone: STATE_TONE[c.status],
        detail: detailOf(c, review),
        permissions: c.permissions.map((p) => PERMISSION_TEXT[p]),
        approvedText: `Aprovada em ${dayMonth(c.approvedAt)}`,
        lastUsedText: c.lastUsedAt === null ? 'Ainda não usada' : `Último uso ${relativeTime(c.lastUsedAt, now)}`,
        reviewRequestId: c.status === 'needs_review' ? (review?.id ?? null) : null,
        actions: { pause: c.status === 'active', resume: c.status === 'paused', history: true, revoke: true, review: c.status === 'needs_review' && review !== undefined },
      };
    });
}
