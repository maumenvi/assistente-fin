import { AgentError } from './agent.error.ts';

/**
 * A pessoa negou a pasta, o caminho esta na lista de proibidos ou ela escolheu OUTRA pasta (`redirected`; `redirectTo`):
 * a ferramenta nao acessa o arquivo (spec 040, FR-010).
 */
export class FolderAccessDeniedError extends AgentError {
  public readonly reason: 'denied' | 'forbidden' | 'redirected';
  public readonly redirectTo: string | null;

  public constructor(reason: 'denied' | 'forbidden' | 'redirected' = 'denied', redirectTo: string | null = null) {
    super(
      'FOLDER_ACCESS_DENIED',
      reason === 'denied'
        ? 'a pessoa nao autorizou o acesso a esta pasta'
        : reason === 'forbidden'
          ? 'este caminho nao pode ser acessado pelo assistente'
          : `a pessoa autorizou outra pasta (${redirectTo ?? '?'}); refaca o pedido dentro dela`,
    );
    this.reason = reason;
    this.redirectTo = redirectTo;
  }
}
