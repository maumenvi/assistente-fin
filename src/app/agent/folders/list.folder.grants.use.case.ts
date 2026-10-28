import { type FolderGrant } from '../../../domain/agent/folder/folder.grant.ts';
import { type FolderBroker } from './folder.broker.ts';

/** Pastas liberadas em definitivo para o usuario (tela de configuracoes do assistente). */
export class ListFolderGrantsUseCase {
  private readonly broker: FolderBroker;

  public constructor(broker: FolderBroker) {
    this.broker = broker;
  }

  public execute(input: { readonly userId: string }): Promise<readonly FolderGrant[]> {
    return this.broker.list(input.userId);
  }
}
