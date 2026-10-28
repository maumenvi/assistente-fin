import { type FolderBroker } from './folder.broker.ts';

/** Revoga uma pasta liberada: a partir dai o agente volta a perguntar. Devolve `false` se a concessao nao existe. */
export class RevokeFolderGrantUseCase {
  private readonly broker: FolderBroker;

  public constructor(broker: FolderBroker) {
    this.broker = broker;
  }

  public execute(input: { readonly userId: string; readonly grantId: string }): Promise<boolean> {
    return this.broker.revoke(input.userId, input.grantId);
  }
}
