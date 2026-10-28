import { type CredentialSpec } from '../../../../domain/capability/candidate.ts';
import { type CapabilityRequest } from '../../../../domain/capability/capability.request.ts';
import { type Permission } from '../../../../domain/capability/permission.ts';
import { TRUST_BADGE_TEXT, type TrustBadge } from '../../../../domain/capability/trust.badge.ts';
import { parseHttpUrl } from '../../../../domain/capability/url.host.ts';

export type ApprovalTone = 'ok' | 'warn' | 'danger' | 'neutral';

export type ApprovalState = 'pending' | 'connecting' | 'connected' | 'failed' | 'expired' | 'rejected' | 'changed';

export interface ApprovalForm {
  /** Valores digitados por nome de credencial. */
  readonly credentials: Readonly<Record<string, string>>;
  /** Texto do passo extra das fontes nao verificadas. */
  readonly confirmUntrusted: string;
  /** Aprovacao em andamento (conectando e testando). */
  readonly busy: boolean;
}

export interface ApprovalCardView {
  readonly title: string;
  readonly badge: { readonly id: TrustBadge; readonly text: string; readonly tone: ApprovalTone };
  readonly kindText: string;
  readonly rows: readonly { readonly label: string; readonly value: string }[];
  readonly permissions: readonly string[];
  readonly warnings: readonly string[];
  /** Linhas da diferenca de uma reaprovacao (vazio se for pedido novo). */
  readonly changes: readonly string[];
  readonly credentialFields: readonly CredentialSpec[];
  /** Mostra o passo extra (digitar o nome do publicador). */
  readonly needsUntrustedConfirm: boolean;
  readonly publisherToConfirm: string;
  readonly state: ApprovalState;
  readonly stateText: string;
  readonly canApprove: boolean;
  readonly canReject: boolean;
  readonly approveLabel: string;
  readonly rejectLabel: string;
}

const BADGE_TONE: Readonly<Record<TrustBadge, ApprovalTone>> = { curated: 'ok', official_registry: 'ok', unverified: 'warn' };

const PERMISSION_TEXT: Readonly<Record<Permission, string>> = {
  network: 'Usa a internet',
  sends_user_text: 'Recebe textos que você escreveu',
  sends_financial_values: 'Recebe valores que você digitou',
  needs_credential: 'Pede uma chave de acesso',
};

const STATE_TEXT: Readonly<Record<ApprovalState, string>> = {
  pending: 'Aguardando a sua aprovação',
  connecting: 'Conectando e testando…',
  connected: 'Conectada',
  failed: 'Não foi possível conectar',
  expired: 'Pedido vencido',
  rejected: 'Recusada',
  changed: 'Mudou — precisa de nova aprovação',
};

function stateOf(request: CapabilityRequest, busy: boolean): ApprovalState {
  if (request.status === 'approved') return 'connected';
  if (request.status === 'rejected' || request.status === 'superseded') return 'rejected';
  if (request.status === 'expired') return 'expired';
  if (request.status === 'failed') return busy ? 'connecting' : 'failed';
  if (busy) return 'connecting';
  return request.replacesCapabilityId !== null || (request.diff?.extraInputs.length ?? 0) > 0 ? 'changed' : 'pending';
}

function changeLines(request: CapabilityRequest): string[] {
  const diff = request.diff;
  if (diff === null) return [];
  return [
    ...diff.added.map((n) => `Novo: ${n}`),
    ...diff.changed.map((n) => `Descrição ou campos mudaram: ${n}`),
    ...diff.removed.map((n) => `Removido: ${n}`),
    ...diff.extraInputs.map((n) => `Pede um campo além do declarado: ${n}`),
  ];
}

function formatKb(bytes: number): string {
  return bytes < 1024 ? `${String(bytes)} B` : `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
}

/** Fonte nao verificada ou sem dados declarados exige o passo extra de confirmacao. */
export function needsExtraStep(request: CapabilityRequest): boolean {
  return request.candidate.badge === 'unverified' || request.candidate.declaredEgress.length === 0;
}

/**
 * Logica pura do cartao de aprovacao (spec 034, contracts/ui.screens.md; canvas D15/M15): selo+cor+texto (nunca so cor),
 * linhas do cartao, estados e quando o botao "Aprovar" habilita. Desktop e Android desenham o mesmo modelo.
 */
export function buildApprovalCardView(request: CapabilityRequest, form: ApprovalForm): ApprovalCardView {
  const { candidate } = request;
  const state = stateOf(request, form.busy);
  const isSkill = candidate.kind === 'skill';
  const reapproval = request.replacesCapabilityId !== null;
  const host = candidate.endpointUrl === undefined ? null : (parseHttpUrl(candidate.endpointUrl)?.host ?? null);
  const undeclared = candidate.declaredEgress.length === 0;
  const warnings: string[] = [];
  if (candidate.badge === 'unverified') warnings.push('Fora do catálogo curado. Confirme que você confia neste publicador.');
  if (undeclared && !isSkill) warnings.push('O catálogo não declara os dados enviados.');
  if (state === 'failed' && request.lastError !== null) warnings.push(request.lastError);
  if (state === 'expired') warnings.push('O pedido venceu. Peça de novo ao assistente.');

  const rows = [
    { label: 'Publicador', value: host === null ? candidate.publisher : `${candidate.publisher} · ${host}` },
    ...(request.reason === '' ? [] : [{ label: 'Por que o assistente quer isto (informado por ele)', value: request.reason }]),
    {
      label: 'Dados que podem sair do aparelho',
      value: isSkill ? 'Nada. A skill só orienta o assistente; não executa código.' : undeclared ? 'Não declarado pelo catálogo.' : `${candidate.declaredEgress.join(', ')}.`,
    },
    ...(candidate.skillPreview === undefined
      ? []
      : [{ label: 'Conteúdo da skill', value: `${String(candidate.skillPreview.files)} arquivo(s), ${formatKb(candidate.skillPreview.bytes)}${candidate.skillPreview.excerpt === '' ? '' : ` — “${candidate.skillPreview.excerpt}”`}` }]),
    { label: 'Como revogar', value: 'Em Capacidades. Revogar apaga as credenciais na hora.' },
  ];

  const fields = reapproval ? [] : candidate.credentialSpec;
  const credentialsReady = fields.every((f) => f.optional === true || (form.credentials[f.name] ?? '').trim() !== '');
  const extraOk = !needsExtraStep(request) || form.confirmUntrusted.trim() === candidate.publisher.trim();
  const open = state === 'pending' || state === 'changed' || state === 'failed';

  return {
    title: candidate.name,
    badge: { id: candidate.badge, text: TRUST_BADGE_TEXT[candidate.badge], tone: BADGE_TONE[candidate.badge] },
    kindText: isSkill ? 'Skill de instruções' : 'Servidor remoto',
    rows,
    permissions: candidate.permissions.map((p) => PERMISSION_TEXT[p]),
    warnings,
    changes: changeLines(request),
    credentialFields: fields,
    needsUntrustedConfirm: open && needsExtraStep(request),
    publisherToConfirm: candidate.publisher,
    state,
    stateText: STATE_TEXT[state],
    canApprove: open && credentialsReady && extraOk && !form.busy,
    canReject: open && !form.busy,
    approveLabel: state === 'changed' ? 'Aprovar de novo' : isSkill ? 'Aprovar e instalar' : 'Aprovar e conectar',
    rejectLabel: 'Recusar',
  };
}
