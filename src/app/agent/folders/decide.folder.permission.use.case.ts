import { type FolderBroker } from './folder.broker.ts';
import { type FolderDecision } from './folder.decision.ts';

/**
 * Resposta da pessoa ao cartao de permissao do chat. E o UNICO caminho que cria concessao (acionado pelo clique, via IPC);
 * nenhuma ferramenta nem texto do modelo chega aqui. `UnknownFileRequestError` se o pedido nao existe mais.
 */
export class DecideFolderPermissionUseCase {
  private readonly broker: FolderBroker;

  public constructor(broker: FolderBroker) {
    this.broker = broker;
  }

  public execute(input: { readonly userId: string; readonly requestId: string; readonly decision: FolderDecision; readonly path?: string | undefined }): void {
    this.broker.decide(input.userId, input.requestId, input.decision, input.path ?? null);
  }
}
