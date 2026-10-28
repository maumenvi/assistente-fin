/** Tipos de aviso que o agente anexa a uma mensagem (spec 031). */
export type NoticeKind =
  | 'figures_unverified'
  // spec 036: valores lidos de uma imagem pelo modelo nao sao fatos do app
  | 'image_figures'
  | 'budget_reached'
  | 'truncated'
  | 'offline'
  | 'canned_write'
  | 'canned_scope'
  | 'no_tools'
  | 'settings_shortcut'
  // spec 035: chave/credito e troca de modelo nunca ficam silenciosos
  | 'key_rejected'
  | 'key_expired'
  | 'quota_exhausted'
  | 'fallback_used';

/**
 * Aviso dentro de uma mensagem. `settings_shortcut` carrega uma `action` com o botao que leva
 * a tela de configuracoes (FR-030: o agente so oferece o botao, nunca muda a politica).
 */
export interface NoticePart {
  readonly type: 'notice';
  readonly kind: NoticeKind;
  /** Titulo curto do cartao (spec 035); ausente = so o texto. */
  readonly title?: string;
  readonly text: string;
  readonly action?: { readonly label: string; readonly route: string };
}
