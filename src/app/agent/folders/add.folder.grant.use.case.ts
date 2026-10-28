import { type FolderGrant } from '../../../domain/agent/folder/folder.grant.ts';
import { type FolderBroker } from './folder.broker.ts';

/** "Adicionar pasta" (spec 040): a pessoa escolhe a pasta no dialogo do sistema e ela fica liberada, antes de qualquer pedido do assistente. */
export class AddFolderGrantUseCase {
  private readonly broker: FolderBroker;

  public constructor(broker: FolderBroker) {
    this.broker = broker;
  }

  public execute(input: { readonly userId: string; readonly path: string; readonly mode: 'read' | 'write' }): Promise<FolderGrant> {
    return this.broker.addGrant(input.userId, input.path, input.mode);
  }
}
